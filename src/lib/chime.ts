import "server-only";

import {
  ChimeSDKMeetingsClient,
  CreateAttendeeCommand,
  CreateMeetingCommand,
  DeleteMeetingCommand,
} from "@aws-sdk/client-chime-sdk-meetings";

/**
 * Amazon Chime SDK — the AWS-native provider for messenger video/audio calls
 * (1:1 and group, up to 250). Phase 3 of the full-AWS Live/RTC migration.
 *
 * Model: the caller creates a *meeting* (media placed in ap-southeast-1 — Chime
 * supports it, unlike IVS) and sends its id through the existing data-API call
 * signaling (ring/accept, unchanged); each side then asks for an *attendee* and
 * joins with amazon-chime-sdk-js. The old WebRTC mesh stays behind
 * NEXT_PUBLIC_CALL_PROVIDER (default "mesh") until cutover.
 *
 * Credentials come from the EC2 instance role — it needs
 * chime:CreateMeeting / CreateAttendee / DeleteMeeting (see
 * deploy/aws-ivs-setup.md, Phase 3).
 */

export function chimeIsCallProvider(): boolean {
  return process.env.NEXT_PUBLIC_CALL_PROVIDER === "chime";
}

function chimeClient(): ChimeSDKMeetingsClient {
  // Control region for the Meetings API; media is placed per-meeting below.
  return new ChimeSDKMeetingsClient({
    region: process.env.CHIME_CONTROL_REGION || "ap-southeast-1",
  });
}

/** Meeting + attendee blobs are consumed verbatim by amazon-chime-sdk-js. */
export interface ChimeJoinInfo {
  meeting: Record<string, unknown>;
  attendee: Record<string, unknown>;
}

/**
 * Create a meeting for one call and the creating user's attendee. The media
 * region is ap-southeast-1 (closest to Myanmar users). `callId` becomes the
 * ExternalMeetingId so the meeting is traceable to the call.
 */
export async function createChimeMeeting(
  callId: string,
  userId: string,
): Promise<{ meetingId: string; join: ChimeJoinInfo }> {
  const client = chimeClient();
  const meetingRes = await client.send(
    new CreateMeetingCommand({
      ClientRequestToken: callId,
      ExternalMeetingId: callId.slice(0, 64),
      MediaRegion: process.env.CHIME_MEDIA_REGION || "ap-southeast-1",
    }),
  );
  const meeting = meetingRes.Meeting;
  const meetingId = meeting?.MeetingId;
  if (!meeting || !meetingId) {
    throw new Error("Chime did not return a usable meeting.");
  }
  const attendeeRes = await client.send(
    new CreateAttendeeCommand({
      MeetingId: meetingId,
      ExternalUserId: userId.slice(0, 64),
    }),
  );
  if (!attendeeRes.Attendee) {
    throw new Error("Chime did not return a usable attendee.");
  }
  return {
    meetingId,
    join: {
      meeting: meeting as unknown as Record<string, unknown>,
      attendee: attendeeRes.Attendee as unknown as Record<string, unknown>,
    },
  };
}

/** Join an existing meeting (callee side): mint this user's attendee. Returns
 * null when the meeting has already ended. */
export async function joinChimeMeeting(
  meetingId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await chimeClient().send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: userId.slice(0, 64),
      }),
    );
    return (res.Attendee as unknown as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/** End a meeting (hangup). Best-effort — meetings also auto-expire when empty. */
export async function deleteChimeMeeting(meetingId: string): Promise<void> {
  await chimeClient()
    .send(new DeleteMeetingCommand({ MeetingId: meetingId }))
    .catch(() => undefined);
}
