import { Link } from "react-router";
import type { Visit } from "~/types/visit";
import type { EarnedBadge } from "~/types/auth";
import { getBadgeIcon } from "~/utils/badge-icon";

interface SummaryLayoutProps {
  title: string;
  greeting: string;
  period: string;
  isLoading: boolean;
  visits: (Visit & { photoUrl?: string })[];
  badges: EarnedBadge[];
  ctaLabel: string;
  errorMessage?: string | null;
}

export default function SummaryLayout({
  title,
  greeting,
  period,
  isLoading,
  visits,
  badges,
  ctaLabel,
  errorMessage,
}: SummaryLayoutProps) {
  const totalXP = visits.reduce((sum, v) => sum + (v.xp_earned ?? 0), 0);
  const visitCount = visits.length;

  return (
    <div
      style={{
        backgroundColor: "#102222",
        minHeight: "100dvh",
        paddingBottom: "32px",
      }}
    >
      {/* 戻るボタン */}
      <div style={{ padding: "16px 16px 0" }}>
        <Link
          to="/history"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "22px" }}
          >
            arrow_back
          </span>
        </Link>
      </div>

      {/* カード本体 */}
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <span
              className="material-symbols-outlined animate-spin"
              style={{ fontSize: "40px", color: "#13ecec" }}
            >
              progress_activity
            </span>
          </div>
        ) : (
          <>
            {/* 挨拶・タイトル */}
            <p
              style={{
                color: "#b0cccc",
                fontSize: "16px",
                lineHeight: 1.6,
                margin: "0 0 8px",
              }}
            >
              {greeting}
            </p>
            <h2
              style={{
                color: "#ffffff",
                margin: "0 0 24px",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              {title}
            </h2>

            {/* エラー表示 */}
            {errorMessage ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: "#ff6b6b",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "48px",
                    display: "block",
                    marginBottom: "12px",
                  }}
                >
                  error_outline
                </span>
                <p style={{ fontSize: "15px", margin: 0 }}>{errorMessage}</p>
              </div>
            ) : (
              <>
                {/* 統計カード */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    margin: "0 0 8px",
                  }}
                >
                  {/* 訪問件数 */}
                  <div
                    style={{
                      backgroundColor: "#1a3333",
                      borderRadius: "16px",
                      padding: "24px 16px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "28px",
                        color: "#FF9600",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      location_on
                    </span>
                    <div
                      style={{
                        color: "#FF9600",
                        fontSize: "52px",
                        fontWeight: 900,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                      }}
                    >
                      {visitCount}
                    </div>
                    <div
                      style={{
                        color: "#b0cccc",
                        fontSize: "14px",
                        marginTop: "6px",
                        fontWeight: 700,
                      }}
                    >
                      か所を冒険!
                    </div>
                  </div>

                  {/* 獲得XP */}
                  <div
                    style={{
                      backgroundColor: "#1a3333",
                      borderRadius: "16px",
                      padding: "24px 16px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "28px",
                        color: "#13ecec",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      bolt
                    </span>
                    <div
                      style={{
                        color: "#13ecec",
                        fontSize: "52px",
                        fontWeight: 900,
                        lineHeight: 1,
                        letterSpacing: "-1px",
                      }}
                    >
                      {totalXP}
                    </div>
                    <div
                      style={{
                        color: "#6b8a8a",
                        fontSize: "14px",
                        marginTop: "6px",
                        fontWeight: 700,
                      }}
                    >
                      XP 獲得!
                    </div>
                  </div>
                </div>

                {/* 表示期間ラベル */}
                <p
                  style={{
                    color: "#6b8a8a",
                    fontSize: "13px",
                    textAlign: "center",
                    marginBottom: "24px",
                    marginTop: 0,
                  }}
                >
                  {period}
                </p>

                {/* 訪れた場所 */}
                {visits.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3
                      style={{
                        color: "#ffffff",
                        margin: "0 0 12px",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    >
                      訪れた場所
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {visits.map((visit) => (
                        <div
                          key={visit.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0",
                          }}
                        >
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              backgroundColor: "#1a3333",
                              borderRadius: "8px 0 0 8px",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            {visit.photoUrl ? (
                              <img
                                src={visit.photoUrl}
                                alt={visit.place_name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "20px", color: "#6b8a8a" }}
                              >
                                location_on
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              backgroundColor: "#1a3333",
                              borderRadius: "0 8px 8px 0",
                              padding: "10px 16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{ color: "#b0cccc", fontSize: "15px" }}
                            >
                              {visit.place_name}
                            </span>
                            <span
                              style={{
                                color: "#13ecec",
                                fontSize: "13px",
                                fontWeight: 700,
                                flexShrink: 0,
                                marginLeft: "8px",
                              }}
                            >
                              +{visit.xp_earned} XP
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* バッジ */}
                {badges.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3
                      style={{
                        color: "#ffffff",
                        margin: "0 0 12px",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    >
                      ゲットしたバッジ
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {badges.map((badge) => {
                        const { icon } = getBadgeIcon(badge.name);
                        return (
                          <div
                            key={badge.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0",
                            }}
                          >
                            <div
                              style={{
                                width: "44px",
                                height: "44px",
                                backgroundColor: "#1a3333",
                                borderRadius: "8px 0 0 8px",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: "20px",
                                  color: "#525BBB",
                                  fontVariationSettings: "'FILL' 1",
                                }}
                              >
                                {icon}
                              </span>
                            </div>
                            <div
                              style={{
                                flex: 1,
                                backgroundColor: "#1a3333",
                                borderRadius: "0 8px 8px 0",
                                padding: "10px 16px",
                              }}
                            >
                              <span
                                style={{ color: "#b0cccc", fontSize: "15px" }}
                              >
                                {badge.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* データなし */}
                {visits.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px 0",
                      color: "#6b8a8a",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "48px",
                        display: "block",
                        marginBottom: "12px",
                      }}
                    >
                      explore_off
                    </span>
                    <p
                      style={{
                        fontSize: "16px",
                        margin: "0 0 4px",
                        color: "#b0cccc",
                      }}
                    >
                      この期間の冒険記録がありません
                    </p>
                    <p style={{ fontSize: "13px", margin: 0 }}>
                      次の期間もどこかへ行ってみよう！
                    </p>
                  </div>
                )}

                {/* CTAボタン */}
                <div style={{ textAlign: "center", marginTop: "32px" }}>
                  <Link
                    to="/home"
                    style={{
                      backgroundColor: "#525BBB",
                      color: "#ffffff",
                      textDecoration: "none",
                      padding: "14px 32px",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: 700,
                      display: "inline-block",
                    }}
                  >
                    {ctaLabel}
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
