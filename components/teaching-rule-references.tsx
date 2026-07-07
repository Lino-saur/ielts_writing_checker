import type { TeachingRuleReference } from "@/lib/types";

function getRuleReferenceLabel(reference: TeachingRuleReference) {
  const lesson = reference.sourceTitle?.match(/Lesson\s+\d+/i)?.[0];
  const source =
    lesson ??
    (reference.sourceTitle?.toLowerCase().includes("ielts")
      ? "IELTS"
      : reference.sourceTitle?.toLowerCase().includes("system")
        ? "System"
        : reference.sourceTitle);
  return [source, reference.knowledgePointCode ?? reference.id].filter(Boolean).join(" · ");
}

export function TeachingRuleReferences({
  references,
  label
}: {
  references?: TeachingRuleReference[];
  label: string;
}) {
  if (!references?.length) return null;

  return (
    <div className="teachingRuleReferences" aria-label={label}>
      <span className="teachingRuleReferencesLabel">{label}</span>
      <div className="teachingRuleReferenceList">
        {references.map((reference) => (
          <span
            key={`${reference.id}-${reference.version ?? "current"}`}
            className="teachingRuleReference"
            title={[
              reference.sourceTitle,
              reference.sourceSection,
              reference.knowledgePointCode
            ].filter(Boolean).join(" · ")}
          >
            {getRuleReferenceLabel(reference)}
          </span>
        ))}
      </div>
    </div>
  );
}
