import { ToolsIndex } from "@/components/tools/tools-index";
import { getCurrentProfile, hasRole } from "@/lib/auth";

export default async function ToolsPage() {
  const profile = await getCurrentProfile();
  const isMember = profile ? hasRole(profile.role, "member") : false;

  return <ToolsIndex isMember={isMember} />;
}
