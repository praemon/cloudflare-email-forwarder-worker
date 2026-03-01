export interface Env {
  /** KV namespace whose keys are the allowed alias addresses. */
  ALLOWED_ALIASES: KVNamespace;
  /** Destination address that all allowed aliases forward to. */
  FORWARD_TO: string;
}

/** Shape of the JSON stored by the simplelogin-api worker. */
interface AliasRecord {
  enabled: boolean;
  [key: string]: unknown;
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker only handles email.", { status: 200 });
  },

  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const alias = message.to.toLowerCase().trim();

    // Look up the alias in KV.
    const raw = await env.ALLOWED_ALIASES.get(alias);

    if (raw === null) {
      // Alias is not recognised — drop the message.
      message.setReject(
        `550 5.1.1 The email account that you tried to reach does not exist. ` +
        `Please try double-checking the recipient's email address for typos or unnecessary spaces.`,
      );
      console.log(`[drop] ${alias} — not found in KV`);
      return;
    }

    // Parse the stored record and check the enabled flag.
    let enabled = true;
    try {
      const record: AliasRecord = JSON.parse(raw);
      enabled = record.enabled !== false; // treat missing/non-boolean as enabled
    } catch {
      // Legacy plain-string values (non-JSON) are treated as enabled.
    }

    if (!enabled) {
      message.setReject(
        `550 5.2.1 The email account that you tried to reach is disabled.`,
      );
      console.log(`[drop] ${alias} — alias is disabled`);
      return;
    }

    // Alias exists and is enabled — forward to the configured destination.
    await message.forward(env.FORWARD_TO);
    console.log(`[forward] ${alias} → ${env.FORWARD_TO}`);
  },
};
