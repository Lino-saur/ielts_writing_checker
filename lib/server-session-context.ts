import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";
import { getSession } from "@/lib/auth-session";
import type { ClientSessionContext } from "@/lib/auth-client-session";
import { reportOperationalEvent } from "@/lib/observability";

export async function getServerSessionContext(): Promise<ClientSessionContext> {
  let session = null;

  try {
    session = await getSession();
  } catch (error) {
    await reportOperationalEvent("error", "session_context_failed", {
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : typeof error
    });
    return {
      user: null,
      energy: null,
      reviewCost: null
    };
  }

  if (!session) {
    return {
      user: null,
      energy: null,
      reviewCost: null
    };
  }

  const energy = await getEnergyState(session.user.id);

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email
    },
    energy,
    reviewCost: getReviewEnergyCost()
  };
}
