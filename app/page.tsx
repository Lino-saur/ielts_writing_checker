"use client";

import { useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { ActionLink } from "@/components/ui-kit";

const COLOR_IMAGES = {
  gray: "/around-product/study-overhead.jpg",
  blue: "/around-product/proofreading-closeup.jpg",
  green: "/around-product/hero-study.jpg",
  pink: "/around-product/review-paper.jpg"
} as const;

type ColorMode = keyof typeof COLOR_IMAGES;

export default function LandingPage() {
  const [locale, setLocale] = useRouteLocale();
  const [colorMode, setColorMode] = useState<ColorMode>("green");
  const { landing: t, navbar } = getMessages(locale);
  const showExtendedSections = false;
  const showFooterContactMeta = false;

  const colorLabels = {
    gray: t.modeGray,
    blue: t.modeBlue,
    green: t.modeGreen,
    pink: t.modePink
  } as const;

  return (
    <main className="aroundProductPage">
      <div className="aroundProductHeaderShell">
        <AppNavbar locale={locale} onLocaleChange={setLocale} copy={navbar} />
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
                <ActionLink href={`/${locale}/checker`} className="aroundOutlineButton">
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
                    <p>{t.feedbackRangeLabel}</p>
                  </div>
                  <div>
                    <h3>0.75 kg</h3>
                    <p>{t.workspaceWeightLabel}</p>
                  </div>
                </div>
                <ActionLink href={`/${locale}/checker`} className="aroundDarkButton">
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
              <ActionLink href={`/${locale}/checker`} className="aroundOutlineLightButton">
                {t.footerPrimary}
              </ActionLink>
            </div>

            <div className="footerLinks">
              <div>
                <ul>
                  <li>
                    <a href={`/${locale}/checker?task=task1`}>{t.footerNavOne}</a>
                  </li>
                  <li>
                    <a href={`/${locale}/checker?task=task2`}>{t.footerNavTwo}</a>
                  </li>
                  <li>
                    <a href={`/${locale}/checker`}>{t.footerNavThree}</a>
                  </li>
                  <li>
                    <a href={`/${locale}/checker`}>{t.footerNavFour}</a>
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
