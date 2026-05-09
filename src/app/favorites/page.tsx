import { AppShell, PageIntro } from "@/components/app-shell";
import { getCommunityProperties } from "@/lib/community-property";
import { properties } from "@/lib/data";
import { FavoritesClient } from "./favorites-client";

export const revalidate = 300;

export default async function FavoritesPage() {
  const communityProperties = await getCommunityProperties();
  const allProperties = [...properties, ...communityProperties];

  return (
    <AppShell>
      <section className="w-full px-4 py-10 sm:px-6 lg:px-8 2xl:px-10">
        <PageIntro
          eyebrow="MY FAVORITES"
          title="我的收藏"
          description="收藏会跟随当前登录账号保存到服务器数据库，换设备或重新登录后也能继续查看。"
        />
        <div className="mt-8">
          <FavoritesClient properties={allProperties} />
        </div>
      </section>
    </AppShell>
  );
}
