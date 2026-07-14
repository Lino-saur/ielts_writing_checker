#!/usr/bin/env python3
"""Extract slide text, tables, chart caches, and speaker notes from PPTX files."""

from __future__ import annotations

import argparse
import html
import re
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
REL_ID = f"{{{NS['r']}}}id"


def natural_number(path: str) -> int:
    match = re.search(r"(\d+)(?=\.xml$)", path)
    return int(match.group(1)) if match else 0


def read_xml(archive: zipfile.ZipFile, name: str) -> ET.Element | None:
    try:
        return ET.fromstring(archive.read(name))
    except (KeyError, ET.ParseError):
        return None


def paragraph_text(paragraph: ET.Element) -> str:
    pieces: list[str] = []
    for node in paragraph.iter():
        local = node.tag.rsplit("}", 1)[-1]
        if local in {"t", "v"} and node.text:
            pieces.append(node.text)
        elif local == "tab":
            pieces.append("\t")
        elif local == "br":
            pieces.append("\n")
    return "".join(pieces).strip()


def text_lines(element: ET.Element) -> list[str]:
    lines: list[str] = []
    for paragraph in element.findall(".//a:p", NS):
        value = paragraph_text(paragraph)
        if value:
            lines.extend(part.strip() for part in value.splitlines() if part.strip())
    return lines


def relationship_targets(archive: zipfile.ZipFile, source_name: str) -> dict[str, str]:
    source = PurePosixPath(source_name)
    rels_name = str(source.parent / "_rels" / f"{source.name}.rels")
    root = read_xml(archive, rels_name)
    if root is None:
        return {}

    targets: dict[str, str] = {}
    for relationship in root.findall("rel:Relationship", NS):
        rel_id = relationship.attrib.get("Id")
        target = relationship.attrib.get("Target")
        if not rel_id or not target or relationship.attrib.get("TargetMode") == "External":
            continue
        combined = source.parent / target
        normalized_parts: list[str] = []
        for part in combined.parts:
            if part == "..":
                if normalized_parts:
                    normalized_parts.pop()
            elif part != ".":
                normalized_parts.append(part)
        targets[rel_id] = "/".join(normalized_parts)
    return targets


def extract_chart(archive: zipfile.ZipFile, chart_name: str) -> list[str]:
    root = read_xml(archive, chart_name)
    if root is None:
        return []

    lines: list[str] = []
    title = " ".join(node.text.strip() for node in root.findall(".//c:title//a:t", NS) if node.text and node.text.strip())
    if title:
        lines.append(f"图表标题：{title}")

    for index, series in enumerate(root.findall(".//c:ser", NS), start=1):
        series_name_values = [
            node.text.strip()
            for node in series.findall("./c:tx//c:v", NS)
            if node.text and node.text.strip()
        ]
        series_name = " / ".join(series_name_values) or f"系列 {index}"
        categories = [
            node.text.strip()
            for node in series.findall("./c:cat//c:pt/c:v", NS)
            if node.text and node.text.strip()
        ]
        values = [
            node.text.strip()
            for node in series.findall("./c:val//c:pt/c:v", NS)
            if node.text and node.text.strip()
        ]
        lines.append(f"图表系列：{series_name}")
        if categories:
            lines.append("分类：" + " | ".join(categories))
        if values:
            lines.append("数值：" + " | ".join(values))
    return lines


def extract_shape_tree(
    archive: zipfile.ZipFile,
    element: ET.Element,
    relationships: dict[str, str],
) -> tuple[list[str], int]:
    lines: list[str] = []
    image_count = 0

    for child in list(element):
        local = child.tag.rsplit("}", 1)[-1]
        if local in {"sp", "cxnSp"}:
            lines.extend(text_lines(child))
        elif local == "graphicFrame":
            table = child.find(".//a:tbl", NS)
            if table is not None:
                lines.append("[表格]")
                for row_index, row in enumerate(table.findall("a:tr", NS), start=1):
                    cells = [" ".join(text_lines(cell)).strip() for cell in row.findall("a:tc", NS)]
                    lines.append(f"表格第 {row_index} 行：" + " | ".join(cells))
            chart = child.find(".//c:chart", NS)
            if chart is not None:
                chart_target = relationships.get(chart.attrib.get(REL_ID, ""))
                if chart_target:
                    lines.append("[图表对象]")
                    lines.extend(extract_chart(archive, chart_target))
            if table is None and chart is None:
                lines.extend(text_lines(child))
        elif local == "pic":
            image_count += 1
            metadata = child.find(".//p:cNvPr", NS)
            if metadata is not None:
                description = metadata.attrib.get("descr") or metadata.attrib.get("title")
                if description and not description.lower().startswith("picture"):
                    lines.append(f"[图片说明：{description.strip()}]")
        elif local in {"grpSp", "spTree"}:
            nested_lines, nested_images = extract_shape_tree(archive, child, relationships)
            lines.extend(nested_lines)
            image_count += nested_images

    compact: list[str] = []
    for line in lines:
        normalized = html.unescape(re.sub(r"[ \t]+", " ", line)).strip()
        if normalized and (not compact or compact[-1] != normalized):
            compact.append(normalized)
    return compact, image_count


def extract_notes(archive: zipfile.ZipFile, slide_name: str, relationships: dict[str, str]) -> list[str]:
    note_target = next(
        (target for target in relationships.values() if target.startswith("ppt/notesSlides/notesSlide")),
        None,
    )
    if not note_target:
        return []
    root = read_xml(archive, note_target)
    if root is None:
        return []
    lines = text_lines(root)
    return [line for line in lines if not re.fullmatch(r"\d+", line)]


def extract_deck(path: Path) -> tuple[str, dict[str, int]]:
    sections: list[str] = [f"# {path.stem}", ""]
    stats = {"slides": 0, "text_slides": 0, "image_only_slides": 0, "images": 0}

    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            ),
            key=natural_number,
        )
        stats["slides"] = len(slide_names)

        for slide_number, slide_name in enumerate(slide_names, start=1):
            root = read_xml(archive, slide_name)
            relationships = relationship_targets(archive, slide_name)
            lines: list[str] = []
            image_count = 0
            if root is not None:
                shape_tree = root.find(".//p:spTree", NS)
                if shape_tree is not None:
                    lines, image_count = extract_shape_tree(archive, shape_tree, relationships)

            notes = extract_notes(archive, slide_name, relationships)
            stats["images"] += image_count
            if lines:
                stats["text_slides"] += 1
            elif image_count:
                stats["image_only_slides"] += 1

            sections.extend([f"## 第 {slide_number} 页", ""])
            if lines:
                sections.extend(lines)
            elif image_count:
                sections.append("[本页没有可提取的文本层，主要内容可能位于图片中]")
            else:
                sections.append("[本页未检测到文本内容]")
            if notes:
                sections.extend(["", "### 演讲者备注", "", *notes])
            sections.append("")

    return "\n".join(sections).rstrip() + "\n", stats


def lesson_number(path: Path) -> int:
    match = re.search(r"Lesson\+(\d+)", path.name)
    return int(match.group(1)) if match else 999


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("pptx", nargs="+", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    decks = sorted(args.pptx, key=lesson_number)
    combined: list[str] = ["# 强化写作课程 PPT 文本汇总", ""]
    summary_rows: list[str] = []

    for deck in decks:
        content, stats = extract_deck(deck)
        lesson = lesson_number(deck)
        output = args.output_dir / f"lesson-{lesson:02d}.md"
        output.write_text(content, encoding="utf-8")
        combined.extend([content.rstrip(), ""])
        summary_rows.append(
            f"- Lesson {lesson}: {stats['slides']} 页，{stats['text_slides']} 页含文本层，"
            f"{stats['image_only_slides']} 页疑似纯图片，共 {stats['images']} 个图片对象"
        )

    combined_path = args.output_dir / "all-lessons.md"
    combined_path.write_text("\n".join(combined).rstrip() + "\n", encoding="utf-8")
    readme = "\n".join(
        [
            "# 提取说明",
            "",
            "文本按照 Lesson 和 PPT 页码组织，并保留表格、图表缓存数据和演讲者备注。",
            "PPT 中作为图片嵌入的文字无法通过文本层直接提取，统计如下：",
            "",
            *summary_rows,
            "",
            "合并版本：`all-lessons.md`。",
        ]
    )
    (args.output_dir / "README.md").write_text(readme + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
