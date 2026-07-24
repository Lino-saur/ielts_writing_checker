"use client";

import Link from "next/link";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";

type LegalKind = "privacy" | "terms" | "refund";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

const legalCopy: Record<"zh-CN" | "en", Record<LegalKind, { title: string; intro: string; sections: LegalSection[] }>> = {
  "zh-CN": {
    privacy: {
      title: "隐私政策",
      intro: "本政策说明我们在提供 IELTS 写作批改、练习记录、账号与客服服务时如何处理你的信息。",
      sections: [
        { title: "我们收集的信息", items: ["账号信息：姓名、邮箱、登录与验证记录。", "学习内容：题目、作文、目标分数、批改结果及你主动上传的 Task 1 图片。", "交易与客服信息：订单、权益、退款申请、反馈内容和客服往来。", "安全与运行信息：请求时间、错误、设备与网络相关的必要技术日志。"] },
        { title: "处理目的", items: ["提供身份验证、批改、历史记录、导出与分享功能。", "计算和管理墨水或不限次权益，处理订单与售后。", "防止滥用、排查故障、改善批改质量与产品体验。", "履行适用法律要求并保护用户和服务安全。"] },
        { title: "第三方处理", paragraphs: ["为完成服务，我们可能使用云部署、数据库、对象存储、邮件和 AI 模型服务商。作文和图片仅在完成批改所需范围内发送给配置的 AI 服务商。若相关处理涉及个人信息跨境，我们会按照适用要求另行告知并取得必要授权。"] },
        { title: "保存与删除", paragraphs: ["我们仅在实现服务、处理争议和履行法定义务所需期间保存信息。你可以在账户菜单中注销账号；学习内容和可删除的账号信息会进入清理流程，依法需要保留的交易记录将去标识化并限制访问。对象存储文件和公开分享链接也会同步撤销或删除。"] },
        { title: "你的权利", items: ["访问、更正、复制或删除你的信息。", "撤回非必要处理的同意，或注销账号。", "通过客服邮箱咨询个人信息处理或提出投诉。"] },
        { title: "未成年人", paragraphs: ["本产品面向学习用户。未满 14 周岁的用户应在监护人知情同意和指导下使用；如我们发现缺少必要的监护人同意，将限制处理并协助删除相关信息。"] },
        { title: "安全措施", paragraphs: ["我们采用访问控制、加密传输、频率限制、操作审计、备份和安全监控等措施降低数据泄露、篡改或滥用风险。互联网服务无法保证绝对安全，发生安全事件时我们将按适用要求处置和通知。"] }
      ]
    },
    terms: {
      title: "用户协议",
      intro: "使用本服务即表示你同意以下规则。若你代表未成年人使用，应由监护人阅读并同意。",
      sections: [
        { title: "服务说明", paragraphs: ["本服务通过 AI 提供 IELTS 写作练习、估分和修改建议。结果仅供学习参考，不是 IELTS 官方成绩，也不能替代教师、考试机构或专业意见。"] },
        { title: "账号责任", items: ["请提供真实、可用的邮箱并妥善保管账号。", "不得共享、出售账号或绕过权益、限流和安全控制。", "发现异常登录或账号被盗时应及时联系我们。"] },
        { title: "内容与授权", paragraphs: ["你保留所提交作文和图片的合法权利，并确认有权上传相关内容。你授权我们仅为提供批改、存储、导出、分享和安全保障所必需的范围处理这些内容。未经你主动分享，我们不会将作文作为公开内容展示。"] },
        { title: "禁止行为", items: ["上传违法、侵权、恶意代码或与学习服务无关的内容。", "自动化批量请求、攻击、探测或干扰服务。", "冒用他人身份，侵犯他人隐私或知识产权。", "转售服务、破解权益或利用结果实施学术作弊。"] },
        { title: "服务可用性", paragraphs: ["AI、邮件、云存储等第三方服务可能导致短时中断或结果波动。我们会努力恢复服务，并对已扣除但未完成的批改按系统规则返还权益。"] },
        { title: "协议变更与联系", paragraphs: ["重要规则发生变化时，我们会通过页面提示或账号联系方式告知。继续使用前可查看更新内容；如不同意，可停止使用并注销账号。"] }
      ]
    },
    refund: {
      title: "退款规则",
      intro: "你可以在“我的订单”中提交订单疑问或退款申请，并查看处理进度。",
      sections: [
        { title: "可申请情形", items: ["未使用的次数包或不限次权益，可申请全额退款。", "重复支付、金额异常或权益未到账，可提交订单疑问并由客服核对。", "已开始使用的订单将进入人工审核，并结合剩余权益、服务履行情况和适用规则处理。"] },
        { title: "权益处理", paragraphs: ["退款完成后，对应墨水或不限次权益会被收回。若次数包余额不足或时间卡已经使用，系统可能无法自动退款，需要客服进一步核对。"] },
        { title: "处理流程", items: ["打开账户菜单中的“我的订单”。", "选择对应订单，填写退款原因和必要说明。", "运营人员审核后会在订单页更新状态；接入正式支付后，退款将按原支付渠道退回。"] },
        { title: "特殊情况", paragraphs: ["因欺诈、滥用、违反用户协议或无法核实订单导致的申请可能被拒绝。法律另有强制规定的，以适用法律为准。"] }
      ]
    }
  },
  en: {
    privacy: {
      title: "Privacy Policy",
      intro: "This policy explains how we handle information when providing IELTS writing reviews, history, accounts, and support.",
      sections: [
        { title: "Information we collect", items: ["Account details such as name, email, and verification records.", "Learning content such as prompts, essays, target bands, review results, and Task 1 images you upload.", "Orders, entitlements, refund requests, feedback, and support correspondence.", "Technical logs needed for security, reliability, and abuse prevention."] },
        { title: "How we use it", items: ["Provide authentication, reviews, history, exports, and sharing.", "Manage credits, unlimited access, orders, and after-sales support.", "Prevent abuse, diagnose failures, and improve service quality.", "Meet legal obligations and protect users and the service."] },
        { title: "Service providers", paragraphs: ["We may use hosting, database, object storage, email, and AI providers. Essays and images are sent to the configured AI provider only as needed to produce a review. Where cross-border processing applies, we will provide any additional notice or consent required by law."] },
        { title: "Retention and deletion", paragraphs: ["We retain information only as long as needed to provide the service, resolve disputes, and meet legal obligations. Account deletion starts cleanup of learning content, stored files, and active share links. Transaction records that must be retained are de-identified and access-restricted."] },
        { title: "Your choices", items: ["Access, correct, copy, or delete your information.", "Withdraw optional consent or close your account.", "Contact support with a privacy request or complaint."] },
        { title: "Children", paragraphs: ["Users under 14 should use the service only with a parent or guardian's informed consent and guidance. We will restrict processing and assist with deletion where required consent is missing."] },
        { title: "Security", paragraphs: ["We use access controls, encrypted transport, rate limits, audit trails, backups, and monitoring. No internet service can guarantee absolute security; incidents will be handled and notified as required."] }
      ]
    },
    terms: {
      title: "Terms of Service",
      intro: "By using the service, you agree to these terms. A guardian should review them for a minor user.",
      sections: [
        { title: "Service", paragraphs: ["AI-generated IELTS estimates and revision suggestions are for learning only. They are not official IELTS scores and do not replace teachers, exam bodies, or professional advice."] },
        { title: "Accounts", items: ["Use a valid email and protect your credentials.", "Do not sell, share, or bypass account, entitlement, rate-limit, or security controls.", "Contact us promptly if you suspect unauthorized access."] },
        { title: "Your content", paragraphs: ["You retain lawful rights in your essays and images and confirm you may upload them. You grant us permission to process them only as needed for review, storage, export, sharing, and security. We do not publish essays unless you actively share them."] },
        { title: "Acceptable use", items: ["Do not upload illegal, infringing, malicious, or unrelated content.", "Do not automate abusive traffic, attack, probe, or disrupt the service.", "Do not impersonate others or infringe privacy or intellectual property.", "Do not resell the service, defeat entitlements, or use results for academic misconduct."] },
        { title: "Availability", paragraphs: ["AI, email, and cloud providers may cause interruptions or output variation. We aim to restore service and return entitlements when a charged review does not complete under system rules."] },
        { title: "Updates and contact", paragraphs: ["We will provide notice of material changes through the product or account contact details. Review updates before continuing; you may stop using the service and close your account if you disagree."] }
      ]
    },
    refund: {
      title: "Refund Policy",
      intro: "Submit an order question or refund request from My orders and track its status there.",
      sections: [
        { title: "Eligibility", items: ["Unused review packs or unlimited access may receive a full refund.", "Duplicate charges, incorrect amounts, or missing entitlements can be submitted for verification.", "Orders already used require manual review based on remaining benefits, delivered service, and applicable rules."] },
        { title: "Entitlements", paragraphs: ["Refunded credits or unlimited access will be revoked. If credits are no longer available or a pass has been used, automatic refunding may be unavailable and support will review the case."] },
        { title: "Process", items: ["Open My orders from the account menu.", "Choose the order and submit a reason with relevant details.", "Operations will update the status in the order page. Once live payments are enabled, approved refunds return through the original payment method."] },
        { title: "Exceptions", paragraphs: ["Requests involving fraud, abuse, terms violations, or unverifiable orders may be rejected. Mandatory legal rights continue to apply."] }
      ]
    }
  }
};

export function LegalPage({ kind, operatorName, supportEmail }: { kind: LegalKind; operatorName: string; supportEmail: string }) {
  const [locale, setLocale] = useRouteLocale();
  const copy = legalCopy[locale][kind];
  const href = (path: string) => `/${locale}${path}`;
  const updated = locale === "zh-CN" ? "生效日期：2026 年 7 月 23 日" : "Effective: July 23, 2026";

  return (
    <main className="legalPageShell">
      <header className="legalTopbar">
        <Link href={`/${locale}`} className="legalBrand">IELTS Writing Checker</Link>
        <button type="button" onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}>
          {locale === "zh-CN" ? "English" : "简体中文"}
        </button>
      </header>
      <article className="legalDocument">
        <p className="legalEyebrow">{updated}</p>
        <h1>{copy.title}</h1>
        <p className="legalIntro">{copy.intro}</p>
        <div className="legalOperator">
          <span>{locale === "zh-CN" ? "服务提供者" : "Service provider"}</span>
          <strong>{operatorName}</strong>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </div>
        {copy.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </section>
        ))}
      </article>
      <nav className="legalFooterNav" aria-label={locale === "zh-CN" ? "法律文件" : "Legal documents"}>
        <Link href={href("/privacy")}>{legalCopy[locale].privacy.title}</Link>
        <Link href={href("/terms")}>{legalCopy[locale].terms.title}</Link>
        <Link href={href("/refund")}>{legalCopy[locale].refund.title}</Link>
        <Link href={`/${locale}`}>{locale === "zh-CN" ? "返回首页" : "Back home"}</Link>
      </nav>
    </main>
  );
}
