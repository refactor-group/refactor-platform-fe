import type { Metadata } from "next";
import { MemberProfileContainer } from "@/components/ui/members/member-profile-container";
import { Id } from "@/types/general";
import { use } from "react";

export const metadata: Metadata = {
    title: "Member Profile",
    description: "Member Profile page",
};

export default function ProfilePage({
    params,
}: {
    params: Promise<{ id: Id }>;
}) {
    const userId = use(params).id;
    return <MemberProfileContainer userId={userId} />;
}
