import Link from "next/link";
import { Brand } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
export const metadata = { title: "Create your startup" };
export default function NewStartup() {
  return <div className="app-surface"><header className="site-header"><Brand/><span className="demo-tag">Demo mode</span></header><main id="content" className="onboarding"><div className="onboarding-intro"><Link href="/" className="text-link">← Back to the studio</Link><span className="index-label">YOUR STARTING POINT</span><h1 tabIndex={-1}>Every trajectory<br/>starts somewhere.</h1><p className="muted">A few essentials to make this space yours. Your strategy can take shape at your own pace.</p><div className="onboarding-note"><span className="mini-orbit"/><p>A real workspace.<br/><strong>Your way of thinking.</strong></p></div></div><div className="onboarding-form"><h2>Create your startup</h2><ProfileForm/></div></main></div>;
}
