import { Suspense } from "react";
import PracticePageClient from "./practice-client";

export default function PracticePage() {
  return (
    <Suspense>
      <PracticePageClient />
    </Suspense>
  );
}
