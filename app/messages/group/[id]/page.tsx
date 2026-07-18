import GroupChatPanel from "@/components/messages/GroupChatPanel";

export default async function MessagesGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupChatPanel groupId={id} />;
}
