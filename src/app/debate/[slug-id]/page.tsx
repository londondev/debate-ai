"use client";

import { useParams } from "next/navigation";
import DebateRoom from "../../components/DebateRoom";
import { useRouter } from "next/navigation";
import { extractIdFromSlug } from "../../lib/utils";

export default function DebatePage() {
  const params = useParams();
  const router = useRouter();
  const slugId = params["slug-id"] as string;
  const debateId = extractIdFromSlug(slugId);

  const handleBack = () => {
    router.push("/");
  };

  return <DebateRoom debateId={debateId} onBack={handleBack} />;
}