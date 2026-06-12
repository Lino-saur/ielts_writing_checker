"use client";

import { useEffect } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { ActionLink } from "@/components/ui-kit";

export default function LandingPageClient() {
  const [locale, setLocale] = useRouteLocale();
  const { landing: t, navbar } = getMessages(locale);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".landingReveal"));
    if (!nodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    for (const node of nodes) {
      if (node.classList.contains("landingRevealImmediate")) {
        node.classList.add("is-visible");
        continue;
      }

      observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <main className="aroundProductPage">
      <div className="aroundProductHeaderShell">
        <AppNavbar locale={locale} onLocaleChange={setLocale} copy={navbar} />
      </div>

      <section className="aroundProductHero landingReveal landingRevealImmediate">
        <div className="aroundProductContainer aroundProductHeroGrid">
          <div className="aroundProductHeroCopy">
            <div className="aroundProductHeroStage aroundProductHeroStagePoster">
              <div className="aroundProductHeroPoster" aria-hidden="true">
                <img src="/hero.jpeg" alt="" />
              </div>

              <div className="aroundProductHeroPrimary aroundProductHeroPrimaryPoster">
                <p className="aroundBetaBadge">{t.betaBadge}</p>
                <p className="aroundHeroKicker">{t.heroKicker}</p>
                <h1>
                  <span>{t.heroTitleLead}</span>
                  <span className="accent">{t.heroTitleAccent}</span>
                </h1>
                <p className="aroundHeroManifesto">{t.heroManifesto}</p>
                <div className="aroundProductHeroActions">
                  <ActionLink href={`/${locale}/checker`} className="aroundOutlineLightButton">
                    {t.heroPrimary}
                  </ActionLink>
                </div>
              </div>

              <div className="aroundProductHeroSummary">
                <div className="aroundProductHeroPanelIntro">
                  <p>{t.heroBody}</p>
                </div>

                <div className="aroundProductHeroStatGrid">
                  <div className="aroundProductHeroStatCard">
                    <div className="value">{t.heroStatOneValue}</div>
                    <div className="label">{t.heroStatOneLabel}</div>
                  </div>
                  <div className="aroundProductHeroStatCard">
                    <div className="value">{t.heroStatTwoValue}</div>
                    <div className="label">{t.heroStatTwoLabel}</div>
                  </div>
                  <div className="aroundProductHeroStatCard aroundProductHeroStatCardWide">
                    <div className="value">{t.heroStatThreeValue}</div>
                    <div className="label">{t.heroStatThreeLabel}</div>
                  </div>
                </div>

                <div className="aroundFeatureList aroundFeatureListHero">
                  <p className="aroundFeatureListTitle">{t.featureListTitle}</p>
                  <ul>
                    <li>{t.featureListItemOne}</li>
                    <li>{t.featureListItemTwo}</li>
                    <li>{t.featureListItemThree}</li>
                  </ul>
                </div>

                <div className="aroundProductHeroPanelLink">
                  <a href={`/${locale}/checker`} className="aroundTextLink">
                    {t.storyLink}
                    <i className="ai-arrow-right" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landingStorySection landingReveal">
        <div className="aroundProductContainer">
          <div className="landingStoryCard landingStoryCardTask1">
            <div className="landingStoryVisual">
              <img src="/around-product/review-paper.jpg" alt="" />
              <div className="landingStoryVisualBadge">{t.sectionTwoBadge}</div>
            </div>
            <div className="landingStoryContent">
              <p className="landingStoryEyebrow">{t.sectionTwoEyebrow}</p>
              <h2>{t.sectionTwoTitle}</h2>
              <p>{t.sectionTwoBody}</p>
              <div className="landingStoryChecklist">
                <div>
                  <strong>{t.sectionTwoPointOneTitle}</strong>
                  <p>{t.sectionTwoPointOneBody}</p>
                </div>
                <div>
                  <strong>{t.sectionTwoPointTwoTitle}</strong>
                  <p>{t.sectionTwoPointTwoBody}</p>
                </div>
                <div>
                  <strong>{t.sectionTwoPointThreeTitle}</strong>
                  <p>{t.sectionTwoPointThreeBody}</p>
                </div>
              </div>
              <ActionLink href={`/${locale}/checker?task=task1`} className="aroundOutlineButton">
                {t.sectionTwoCta}
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      <section className="landingStorySection landingReveal">
        <div className="aroundProductContainer">
          <div className="landingStoryCard landingStoryCardTask2">
            <div className="landingStoryContent">
              <p className="landingStoryEyebrow">{t.sectionThreeEyebrow}</p>
              <h2>{t.sectionThreeTitle}</h2>
              <p>{t.sectionThreeBody}</p>
              <div className="landingMetricStrip">
                <div>
                  <strong>{t.sectionThreeMetricOneValue}</strong>
                  <span>{t.sectionThreeMetricOneLabel}</span>
                </div>
                <div>
                  <strong>{t.sectionThreeMetricTwoValue}</strong>
                  <span>{t.sectionThreeMetricTwoLabel}</span>
                </div>
                <div>
                  <strong>{t.sectionThreeMetricThreeValue}</strong>
                  <span>{t.sectionThreeMetricThreeLabel}</span>
                </div>
              </div>
              <ActionLink href={`/${locale}/checker?task=task2`} className="aroundDarkButton">
                {t.sectionThreeCta}
              </ActionLink>
            </div>
            <div className="landingStoryVisual landingStoryVisualWide">
              <img src="/around-product/proofreading-closeup.jpg" alt="" />
              <div className="landingStoryFloatingNote">
                <strong>{t.sectionThreeNoteTitle}</strong>
                <p>{t.sectionThreeNoteBody}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landingStorySection landingReveal">
        <div className="aroundProductContainer">
          <div className="landingStoryCard landingStoryCardHistory">
            <div className="landingStoryVisual">
              <img src="/around-product/study-overhead.jpg" alt="" />
              <div className="landingTimelineCard">
                <span>{t.sectionFourTimelineLabel}</span>
                <strong>{t.sectionFourTimelineValue}</strong>
              </div>
            </div>
            <div className="landingStoryContent">
              <p className="landingStoryEyebrow">{t.sectionFourEyebrow}</p>
              <h2>{t.sectionFourTitle}</h2>
              <p>{t.sectionFourBody}</p>
              <ul className="landingStoryList">
                <li>{t.sectionFourListOne}</li>
                <li>{t.sectionFourListTwo}</li>
                <li>{t.sectionFourListThree}</li>
              </ul>
              <ActionLink href={`/${locale}/history`} className="aroundOutlineButton">
                {t.sectionFourCta}
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      <section className="landingStorySection landingReveal">
        <div className="aroundProductContainer">
          <div className="landingFeedbackPanel">
            <div>
              <p className="landingStoryEyebrow">{t.sectionFiveEyebrow}</p>
              <h2>{t.sectionFiveTitle}</h2>
              <p>{t.sectionFiveBody}</p>
            </div>
            <div className="landingFeedbackActions">
              <div className="landingFeedbackHintCard">
                <strong>{t.sectionFiveHintTitle}</strong>
                <p>{t.sectionFiveHintBody}</p>
              </div>
              <ActionLink href={`/${locale}/checker`} className="aroundOutlineLightButton landingFeedbackAction">
                {t.sectionFiveCta}
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="aroundProductFooter landingReveal">
        <div className="overlay" aria-hidden="true" />
        <div className="aroundProductContainer aroundProductFooterInner">
          <div className="footerMain">
            <div className="footerLead">
              <h2>
                <span>{t.footerTitleLead}</span>{" "}
                <span className="gradient">{t.footerTitleAccent}</span>
              </h2>

              <div className="footerStats">
                <div>
                  <i className="ai-check-circle" aria-hidden="true" />
                  <span>{t.footerStatOne}</span>
                </div>
                <div>
                  <i className="ai-edit-3" aria-hidden="true" />
                  <span>{t.footerStatTwo}</span>
                </div>
                <div>
                  <i className="ai-layers" aria-hidden="true" />
                  <span>{t.footerStatThree}</span>
                </div>
              </div>

              <ActionLink href={`/${locale}/checker`} className="aroundOutlineLightButton">
                {t.footerPrimary}
              </ActionLink>
            </div>

            <div className="footerLinks">
              <ul>
                <li><strong>{t.footerNavOne}</strong></li>
                <li><a href={`/${locale}/checker?task=task1`}>{t.sectionTwoTitle}</a></li>
                <li><a href={`/${locale}/checker?task=task2`}>{t.sectionThreeTitle}</a></li>
                <li><a href={`/${locale}/history`}>{t.sectionFourTitle}</a></li>
              </ul>

              <ul>
                <li><strong>{t.footerNavFour}</strong></li>
                <li><a href={`mailto:${t.footerMail}`}>{t.footerMail}</a></li>
                <li><span>{t.footerPhoneOne}</span></li>
                <li><span>{t.footerPhoneTwo}</span></li>
              </ul>
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
