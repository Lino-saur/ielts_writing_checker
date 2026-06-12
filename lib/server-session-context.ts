import { getEnergyState, getReviewEnergyCost } from "@/lib/energy";
import { getSession } from "@/lib/auth-session";
import type { ClientSessionContext } from "@/lib/auth-client-session";

export async function getServerSessionContext(): Promise<ClientSessionContext> {
  const session = await getSession();

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
