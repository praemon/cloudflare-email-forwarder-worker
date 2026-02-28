export interface Env {
  /** KV namespace whose keys are the allowed alias addresses. */
  ALLOWED_ALIASES: KVNamespace;
  /** Destination address that all allowed aliases forward to. */
  FORWARD_TO: string;
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker only handles email.", { status: 200 });
  },

  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const alias = message.to.toLowerCase().trim();

    // Look up the alias in KV. A non-null result means it is allowed.
    const allowed = await env.ALLOWED_ALIASES.get(alias);

    if (allowed !== null) {
      // Alias is on the allow-list — forward to the configured destination.
      await message.forward(env.FORWARD_TO);
      console.log(`[forward] ${alias} → ${env.FORWARD_TO}`);
    } else {
      // Alias is not recognised — drop the message.
      message.setReject(`550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.`);
      console.log(`[drop] ${alias} is not an allowed alias`);
    }
  },
};
