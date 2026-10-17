import { OnboardingFlow } from "@/components/onboarding/flow";
import { OnboardingChrome } from "@/ui/screens/onboarding-chrome";

export const metadata = { title: "Create your startup" };

export default function NewStartup() {
  return <OnboardingChrome><OnboardingFlow/></OnboardingChrome>;
}
