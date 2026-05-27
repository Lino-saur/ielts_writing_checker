"use client";

import { useEffect, useRef, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { ActionLink } from "@/components/ui-kit";

const LOCALE_STORAGE_KEY = "app-locale";

const COPY = {
  en: {
    brand: "IELTS Writing Checker",
    task1: "Task 1",
    task2: "Task 2",
    languageLabel: "Language",
    userLabel: "User",
    guestUser: "Guest",
    login: "Log In",
    signInTab: "Sign In",
    signUpTab: "Sign Up",
    authName: "Name",
    authEmail: "Email",
    authPassword: "Password",
    authSubmitSignIn: "Continue",
    authSubmitSignUp: "Create Account",
    authHintSignIn: "Sign in to upgrade from a guest session.",
    authHintSignUp: "Create a formal account for your reviews and energy.",
    authClose: "Close",
    authSignOut: "Sign Out",
    genericError: "Something went wrong.",
    heroTitleLead: "Review",
    heroTitleAccent: "IELTS writing",
    heroBody:
      "A polished review desk for Task 1 and Task 2 with band scoring, inline revisions and session-aware usage.",
    heroPrimary: "Open checker",
    heroStatOneValue: "Task 1 + Task 2",
    heroStatOneLabel: "coverage",
    heroStatTwoValue: "Band rubric",
    heroStatTwoLabel: "feedback",
    heroStatThreeValue: "Guest + account",
    heroStatThreeLabel: "access",
    storyTitle: "A cleaner way to study each draft.",
    storyBody:
      "Move from prompt to report with one focused workflow. Read the score, inspect revisions and decide what to fix next.",
    storyLink: "Read more",
    featureOneTitle: "Band scoring",
    featureOneBody: "Rubric-based scoring with a clear breakdown for task achievement, cohesion, vocabulary and grammar.",
    featureTwoTitle: "Inline notes",
    featureTwoBody: "Each correction stays attached to the essay so users can inspect what changed and why.",
    featureThreeTitle: "Study flow",
    featureThreeBody: "Task switching, target band and usage tracking stay in one place instead of being split across screens.",
    colorsTitleLead: "Flexible",
    colorsTitleRest: "review modes for different writing goals",
    colorsBody:
      "Use the same checker for task practice, quick scoring, revision study and account-linked sessions.",
    modeGray: "Quick scan",
    modeBlue: "Focused review",
    modeGreen: "Full report",
    modePink: "Revision study",
    ctaTitle: "A checker that fits your workflow.",
    ctaBody:
      "Open the writing checker, choose Task 1 or Task 2, then run a full review with inline feedback and band scoring.",
    ctaPrimary: "Go to checker",
    detailsTitle: "Product details",
    detailsOther: "Review tools",
    detailsBattery: "Accounts",
    detailsConnectivity: "Workflow",
    detailsGeneral: "Output",
    detailsHighlights: "Highlights",
    detailsOtherOne: "Band score breakdown",
    detailsOtherTwo: "Priority fixes",
    detailsBatteryOne: "Anonymous session",
    detailsBatteryTwo: "Account upgrade",
    detailsBatteryThree: "Energy tracking",
    detailsConnectivityOne: "Task 1 switch",
    detailsConnectivityTwo: "Task 2 switch",
    detailsGeneralOne: "Annotated draft",
    detailsGeneralTwo: "Strength summary",
    detailsGeneralThree: "Revision reasons",
    detailsHighlightBodyOne:
      "The landing page now follows the Around product layout much more closely: large visual hero, centered media section, split CTA rows, detail columns and a gallery finish.",
    detailsHighlightBodyTwo:
      "The copy and images are placeholders for now. The important part is that the page structure, rhythm and component hierarchy match the original template style.",
    galleryTitle: "Take another look at the checker.",
    galleryBody:
      "These gallery blocks mirror the original product landing composition and can be replaced later with real IELTS-specific visuals.",
    galleryCardOneTitle: "Essay review views",
    galleryCardOneBody: "Use large visual blocks to present the scoring, revision and study experience.",
    galleryCardTwoTitle: "Study for scores that matter",
    galleryCardTwoBody: "Turn the landing page into a product story first, then route users into the working checker.",
    footerTitleLead: "Open the checker and get",
    footerTitleAccent: "faster revision cycles",
    footerStatOne: "Band scoring",
    footerStatTwo: "Inline feedback",
    footerStatThree: "Task coverage",
    footerPrimary: "Start reviewing",
    footerNavOne: "Features",
    footerNavTwo: "Modes",
    footerNavThree: "Details",
    footerNavFour: "Checker",
    footerMail: "hello@example.com",
    footerPhoneOne: "+1 526 220 0459",
    footerPhoneTwo: "+1 526 220 0444",
    footerCopyright: "All rights reserved."
  },
  "zh-CN": {
    brand: "IELTS Writing Checker",
    task1: "Task 1",
    task2: "Task 2",
    languageLabel: "语言",
    userLabel: "用户",
    guestUser: "访客",
    login: "登录",
    signInTab: "登录",
    signUpTab: "注册",
    authName: "昵称",
    authEmail: "邮箱",
    authPassword: "密码",
    authSubmitSignIn: "继续登录",
    authSubmitSignUp: "创建账号",
    authHintSignIn: "登录后即可从访客会话升级为正式账号。",
    authHintSignUp: "创建正式账号，用于绑定批改记录和能量。",
    authClose: "关闭",
    authSignOut: "退出登录",
    genericError: "发生了一些问题。",
    heroTitleLead: "批改",
    heroTitleAccent: "IELTS 写作",
    heroBody: "一个更完整的 Task 1 / Task 2 批改工作台，包含 band 评分、文中修改和会话能力。",
    heroPrimary: "进入批改器",
    heroStatOneValue: "Task 1 + Task 2",
    heroStatOneLabel: "题型覆盖",
    heroStatTwoValue: "Band 标准",
    heroStatTwoLabel: "反馈方式",
    heroStatThreeValue: "访客 + 账号",
    heroStatThreeLabel: "使用模式",
    storyTitle: "用更清楚的路径学习每一篇草稿。",
    storyBody: "从题目到报告走完一条完整流程。先看分数，再看修改痕迹，最后决定下一步怎么改。",
    storyLink: "了解更多",
    featureOneTitle: "Band 评分",
    featureOneBody: "按任务回应、连贯衔接、词汇和语法四项给出更清楚的评分拆解。",
    featureTwoTitle: "文中说明",
    featureTwoBody: "每一处修改都贴在原文里，用户可以直接看到改了什么、为什么改。",
    featureThreeTitle: "学习流程",
    featureThreeBody: "题型切换、目标分和使用记录都留在同一条流程里，不再分散在多个页面。",
    colorsTitleLead: "灵活的",
    colorsTitleRest: "批改模式适配不同练习目标",
    colorsBody: "同一套 checker 可以同时支持快速评分、完整报告、修改学习和账号会话。",
    modeGray: "快速扫描",
    modeBlue: "重点批改",
    modeGreen: "完整报告",
    modePink: "修改学习",
    ctaTitle: "适配你流程的批改器。",
    ctaBody: "进入写作批改页，选择 Task 1 或 Task 2，然后运行带文中反馈和 band 评分的完整批改。",
    ctaPrimary: "打开批改器",
    detailsTitle: "产品细节",
    detailsOther: "批改工具",
    detailsBattery: "账号能力",
    detailsConnectivity: "使用流程",
    detailsGeneral: "结果输出",
    detailsHighlights: "亮点说明",
    detailsOtherOne: "分项评分",
    detailsOtherTwo: "重点修改项",
    detailsBatteryOne: "访客会话",
    detailsBatteryTwo: "账号升级",
    detailsBatteryThree: "能量记录",
    detailsConnectivityOne: "Task 1 切换",
    detailsConnectivityTwo: "Task 2 切换",
    detailsGeneralOne: "批改痕迹",
    detailsGeneralTwo: "优点总结",
    detailsGeneralThree: "修改原因",
    detailsHighlightBodyOne:
      "现在这个首页在结构上已经明显更接近 Around 的 landing-product：大首屏、居中媒体区、分栏 CTA、细节列和结尾 gallery。",
    detailsHighlightBodyTwo:
      "目前文案和资源仍然是占位内容，后面可以再替换成真正表达 IELTS 批改产品的素材。",
    galleryTitle: "再看一遍这个批改器。",
    galleryBody: "这组 gallery 区块直接借用了原版产品落地页的展示节奏，后续可以替换成真实的 IELTS 视觉素材。",
    galleryCardOneTitle: "批改界面展示",
    galleryCardOneBody: "用大图块来呈现评分、修改和学习体验，而不是只靠文字描述。",
    galleryCardTwoTitle: "先讲产品，再引导使用",
    galleryCardTwoBody: "先把首页做成产品故事，再把用户带进真正可用的批改器。",
    footerTitleLead: "打开批改器，获得",
    footerTitleAccent: "更快的修改循环",
    footerStatOne: "Band 评分",
    footerStatTwo: "文中反馈",
    footerStatThree: "题型覆盖",
    footerPrimary: "开始批改",
    footerNavOne: "能力",
    footerNavTwo: "模式",
    footerNavThree: "细节",
    footerNavFour: "批改器",
    footerMail: "hello@example.com",
    footerPhoneOne: "+1 526 220 0459",
    footerPhoneTwo: "+1 526 220 0444",
    footerCopyright: "保留所有权利。"
  }
} as const;

const COLOR_IMAGES = {
  gray: "/around-product/study-overhead.jpg",
  blue: "/around-product/proofreading-closeup.jpg",
  green: "/around-product/hero-study.jpg",
  pink: "/around-product/review-paper.jpg"
} as const;

type Locale = "en" | "zh-CN";
type ColorMode = keyof typeof COLOR_IMAGES;

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [colorMode, setColorMode] = useState<ColorMode>("green");
  const localeHydratedRef = useRef(false);
  const t = COPY[locale];
  const showExtendedSections = false;
  const showFooterContactMeta = false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLocale = params.get("lang");
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const nextLocale =
      urlLocale === "en" || urlLocale === "zh-CN"
        ? urlLocale
        : storedLocale === "en" || storedLocale === "zh-CN"
          ? storedLocale
          : "zh-CN";

    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    localeHydratedRef.current = true;

    if (params.get("lang") !== nextLocale) {
      params.set("lang", nextLocale);
      const nextQuery = params.toString();
      window.history.replaceState({}, "", nextQuery ? `/?${nextQuery}` : "/");
    }
  }, []);

  useEffect(() => {
    if (!localeHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const params = new URLSearchParams(window.location.search);

    if (params.get("lang") !== locale) {
      params.set("lang", locale);
      const nextQuery = params.toString();
      window.history.replaceState({}, "", nextQuery ? `/?${nextQuery}` : "/");
    }
  }, [locale]);

  const colorLabels = {
    gray: t.modeGray,
    blue: t.modeBlue,
    green: t.modeGreen,
    pink: t.modePink
  } as const;

  return (
    <main className="aroundProductPage">
      <div className="aroundProductHeaderShell">
        <AppNavbar locale={locale} onLocaleChange={setLocale} copy={t} />
      </div>

      <section className="aroundProductHero">
        <div className="aroundProductContainer aroundProductHeroGrid">
          <div className="aroundProductHeroCopy">
            <h1>
              <span>{t.heroTitleLead} </span>
              <span className="accent">{t.heroTitleAccent}</span>
              <img src="/around-product/soundwave.svg" alt="" aria-hidden="true" />
            </h1>

            <div className="aroundProductHeroTextBlock">
              <div className="aroundProductHeroLead">
                <p>{t.heroBody}</p>
                <ActionLink href={`/checker?lang=${locale}`} className="aroundOutlineButton">
                  {t.heroPrimary}
                </ActionLink>
              </div>

              <div className="aroundProductHeroMeta">
                <div className="aroundProductStatRow">
                  <div>
                    <div className="value">{t.heroStatOneValue}</div>
                    <div className="label">{t.heroStatOneLabel}</div>
                  </div>
                  <div>
                    <div className="value">{t.heroStatTwoValue}</div>
                    <div className="label">{t.heroStatTwoLabel}</div>
                  </div>
                  <div>
                    <div className="value">{t.heroStatThreeValue}</div>
                    <div className="label">{t.heroStatThreeLabel}</div>
                  </div>
                </div>

                <div className="aroundProductStoryBlock">
                  <h2>{t.storyTitle}</h2>
                  <p>{t.storyBody}</p>
                  <a href={`/checker?lang=${locale}`} className="aroundTextLink">
                    {t.storyLink}
                    <i className="ai-arrow-right" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showExtendedSections ? (
        <>
          <section className="aroundProductContainer aroundProductVideoSection" id="features">
            <div className="aroundProductVideoCover">
              <img src="/around-product/review-paper.jpg" alt="" />
              <button type="button" className="aroundPlayButton" aria-label="Play">
                <i className="ai-play-filled" />
              </button>
            </div>

            <div className="aroundProductFeatureRow">
              {[
                { title: t.featureOneTitle, body: t.featureOneBody, icon: "ai-chart" },
                { title: t.featureTwoTitle, body: t.featureTwoBody, icon: "ai-edit-alt" },
                { title: t.featureThreeTitle, body: t.featureThreeBody, icon: "ai-target" }
              ].map((feature) => (
                <article key={feature.title} className="aroundProductFeature">
                  <i className={`featureIcon ${feature.icon}`} aria-hidden="true" />
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="aroundProductContainer aroundProductColorsSection" id="modes">
            <div className="aroundProductColorsGrid">
              <div className="aroundProductColorVisual">
                <div className="backplate" />
                <div className="imageWrap">
                  <img src={COLOR_IMAGES[colorMode]} alt="" />
                </div>
                <div className="colorLabel">{colorLabels[colorMode]}</div>
                <div className="colorSwitches">
                  {(["gray", "blue", "green", "pink"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={colorMode === option ? "active" : undefined}
                      onClick={() => setColorMode(option)}
                      aria-label={colorLabels[option]}
                    >
                      <span className={`swatch ${option}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="aroundProductSectionCopy">
                <h2>
                  <span className="gradient">{t.colorsTitleLead}</span> {t.colorsTitleRest}
                </h2>
                <p>{t.colorsBody}</p>
              </div>
            </div>
          </section>

          <section className="aroundProductContainer aroundProductCtaSection">
            <div className="aroundProductCtaGrid">
              <div className="aroundProductCtaVisual">
                <div className="ctaVisualFrame">
                  <img src="/around-product/study-overhead.jpg" alt="" />
                  <img src="/around-product/proofreading-closeup.jpg" alt="" className="ctaOverlay" />
                </div>
              </div>

              <div className="aroundProductSectionCopy">
                <h2>{t.ctaTitle}</h2>
                <p>{t.ctaBody}</p>
                <div className="aroundProductMiniStats">
                  <div>
                    <h3>60-200 Hz</h3>
                    <p>{locale === "zh-CN" ? "反馈范围" : "feedback range"}</p>
                  </div>
                  <div>
                    <h3>0.75 kg</h3>
                    <p>{locale === "zh-CN" ? "工作台重量" : "workspace weight"}</p>
                  </div>
                </div>
                <ActionLink href={`/checker?lang=${locale}`} className="aroundDarkButton">
                  {t.ctaPrimary}
                </ActionLink>
              </div>
            </div>
          </section>

          <section className="aroundProductDetailsSection" id="details">
            <div className="aroundProductContainer aroundProductDetailsInner">
              <h2>{t.detailsTitle}</h2>
              <div className="aroundProductHotspotStage">
                <img src="/around-product/study-overhead.jpg" alt="" />
                <button type="button" className="hotspot one" aria-label={t.featureTwoTitle}>
                  <span>+</span>
                </button>
                <button type="button" className="hotspot two" aria-label={t.featureOneTitle}>
                  <span>+</span>
                </button>
                <button type="button" className="hotspot three" aria-label={t.featureThreeTitle}>
                  <span>+</span>
                </button>
              </div>

              <div className="aroundProductDetailsGrid">
                <div>
                  <h3>{t.detailsOther}</h3>
                  <ul>
                    <li>{t.detailsOtherOne}</li>
                    <li>{t.detailsOtherTwo}</li>
                  </ul>
                  <h3>{t.detailsBattery}</h3>
                  <ul>
                    <li>{t.detailsBatteryOne}</li>
                    <li>{t.detailsBatteryTwo}</li>
                    <li>{t.detailsBatteryThree}</li>
                  </ul>
                </div>

                <div>
                  <h3>{t.detailsConnectivity}</h3>
                  <ul>
                    <li>{t.detailsConnectivityOne}</li>
                    <li>{t.detailsConnectivityTwo}</li>
                  </ul>
                  <h3>{t.detailsGeneral}</h3>
                  <ul>
                    <li>{t.detailsGeneralOne}</li>
                    <li>{t.detailsGeneralTwo}</li>
                    <li>{t.detailsGeneralThree}</li>
                  </ul>
                </div>

                <div className="highlights">
                  <h3>{t.detailsHighlights}</h3>
                  <p>{t.detailsHighlightBodyOne}</p>
                  <p>{t.detailsHighlightBodyTwo}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="aroundProductContainer aroundProductGallerySection">
            <div className="aroundProductGalleryIntro">
              <h2>{t.galleryTitle}</h2>
              <p>{t.galleryBody}</p>
            </div>

            <div className="aroundProductGalleryGrid">
              <div className="mediaCard" style={{ backgroundImage: "url(/around-product/hero-study.jpg)" }} />
              <article className="textCard wide">
                <img src="/around-product/proofreading-closeup.jpg" alt="" />
                <div className="body">
                  <h3>{t.galleryCardOneTitle}</h3>
                  <p>{t.galleryCardOneBody}</p>
                </div>
              </article>
              <div className="mediaCard" style={{ backgroundImage: "url(/around-product/review-paper.jpg)" }} />
              <article className="textCard wide split">
                <div className="imagePane">
                  <img src="/around-product/study-overhead.jpg" alt="" />
                </div>
                <div className="body">
                  <h3>{t.galleryCardTwoTitle}</h3>
                  <p>{t.galleryCardTwoBody}</p>
                </div>
              </article>
            </div>
          </section>
        </>
      ) : null}

      <footer className="aroundProductFooter">
        <div className="overlay" />
        <div className="aroundProductContainer aroundProductFooterInner">
          <div className="footerMain">
            <div className="footerLead">
              <h2>
                {t.footerTitleLead} <span className="gradient">{t.footerTitleAccent}</span>
              </h2>
              <div className="footerStats">
                <div>
                  <i className="ai-check-alt" />
                  <span>{t.footerStatOne}</span>
                </div>
                <div>
                  <i className="ai-check-alt" />
                  <span>{t.footerStatTwo}</span>
                </div>
                <div>
                  <i className="ai-check-alt" />
                  <span>{t.footerStatThree}</span>
                </div>
              </div>
              <ActionLink href={`/checker?lang=${locale}`} className="aroundOutlineLightButton">
                {t.footerPrimary}
              </ActionLink>
            </div>

            <div className="footerLinks">
              <div>
                <ul>
                  <li>
                    <a href={`/checker?lang=${locale}&task=task1`}>{t.footerNavOne}</a>
                  </li>
                  <li>
                    <a href={`/checker?lang=${locale}&task=task2`}>{t.footerNavTwo}</a>
                  </li>
                  <li>
                    <a href={`/checker?lang=${locale}`}>{t.footerNavThree}</a>
                  </li>
                  <li>
                    <a href={`/checker?lang=${locale}`}>{t.footerNavFour}</a>
                  </li>
                </ul>
              </div>

              {showFooterContactMeta ? (
                <>
                  <div className="socials">
                    <a href="#" aria-label="Instagram">
                      <i className="ai-instagram" />
                    </a>
                    <a href="#" aria-label="Facebook">
                      <i className="ai-facebook" />
                    </a>
                    <a href="#" aria-label="YouTube">
                      <i className="ai-youtube" />
                    </a>
                  </div>

                  <div>
                    <ul>
                      <li>
                        <a href={`mailto:${t.footerMail}`}>{t.footerMail}</a>
                      </li>
                      <li>
                        <a href={`tel:${t.footerPhoneOne.replace(/\s+/g, "")}`}>{t.footerPhoneOne}</a>
                      </li>
                      <li>
                        <a href={`tel:${t.footerPhoneTwo.replace(/\s+/g, "")}`}>{t.footerPhoneTwo}</a>
                      </li>
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <p className="copyright">
            <span>{t.footerCopyright}</span>
          </p>
        </div>
      </footer>
    </main>
  );
}
