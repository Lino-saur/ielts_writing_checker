import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";
import { getSession } from "@/lib/auth-session";
import type { ClientSessionContext } from "@/lib/auth-client-session";

export async function getServerSessionContext(): Promise<ClientSessionContext> {
  let session = null;

  try {
    session = await getSession();
  } catch (error) {
    console.error("[SESSION][GET_SERVER_SESSION_CONTEXT_FAILED]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
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
