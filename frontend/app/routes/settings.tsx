import { useState } from "react";
import { Icon } from "~/components/Icon";
import type { Route } from "./+types/settings";
import { useNavigate } from "react-router";
import { authRequiredLoader } from "~/lib/auth";
import { getInterests } from "~/api/users";
import { getGenreTags } from "~/api/genres";
import UserInfoTab from "~/components/UserInfoTab";
import SuggestionTab from "~/components/SuggestionTab";
import NotificationTab from "~/components/NotificationTab";

type TabId = "user" | "suggestion" | "notification";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "user", label: "ユーザー", icon: "person" },
  { id: "suggestion", label: "提案設定", icon: "tune" },
  { id: "notification", label: "通知", icon: "notifications" },
];

export async function clientLoader() {
  const { user, token: authToken } = await authRequiredLoader();
  const [genres, interests] = await Promise.all([
    getGenreTags(authToken),
    getInterests(authToken),
  ]);
  return { user, token: authToken, genres, interests };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { user, token: authToken, genres, interests } = loaderData;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("user");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white/10"
            aria-label="戻る"
          >
            <Icon name="arrow_back" className="text-xl text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-center">設定</h1>
          <div className="size-10" />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="px-4 pt-4" role="tablist">
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-gray-800 text-gray-200 shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon name={tab.icon} className="text-base" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 py-6" role="tabpanel">
        {activeTab === "user" && (
          <UserInfoTab authToken={authToken} user={user} />
        )}
        {activeTab === "suggestion" && (
          <SuggestionTab
            authToken={authToken}
            genres={genres}
            initialInterests={interests}
            initialRadius={user.search_radius ?? 10000}
          />
        )}
        {activeTab === "notification" && (
          <NotificationTab authToken={authToken} />
        )}
      </div>
    </div>
  );
}
