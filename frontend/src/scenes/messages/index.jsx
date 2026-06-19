/*
  author: GitHub Copilot
  description: Inbox and direct messaging workspace for CollabConnect.
*/
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Divider, TextField, useTheme } from "@mui/material";
import axios from "axios";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import { MessageSquare, Send, Inbox, Sparkles } from "lucide-react";

const Messages = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const recipientId = searchParams.get("recipient");

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversation_id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const activeRecipient = recipientProfile || selectedConversation;

  useEffect(() => {
    fetchInbox();
    if (recipientId) {
      fetchRecipientProfile(recipientId);
    } else {
      setRecipientProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId]);

  useEffect(() => {
    if (!recipientId || conversations.length === 0) {
      return;
    }

    const existingConversation = conversations.find(
      (conversation) => String(conversation.other_person_id) === String(recipientId)
    );

    if (existingConversation) {
      setSelectedConversationId(existingConversation.conversation_id);
    } else if (!selectedConversationId) {
      setSelectedConversationId(null);
    }
  }, [conversations, recipientId, selectedConversationId]);

  useEffect(() => {
    if (!recipientId && conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].conversation_id);
    }
  }, [conversations, recipientId, selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      fetchConversationMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const fetchInbox = async () => {
    try {
      setLoadingInbox(true);
      setError(null);

      const response = await axios.get("http://127.0.0.1:5001/messages/inbox");
      const inbox = response.data.data || [];
      setConversations(inbox);

      if (!selectedConversationId && inbox.length > 0 && !recipientId) {
        setSelectedConversationId(inbox[0].conversation_id);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load messages");
    } finally {
      setLoadingInbox(false);
    }
  };

  const fetchRecipientProfile = async (personId) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5001/person/${personId}`);
      setRecipientProfile(response.data.data?.person || null);
    } catch (err) {
      setRecipientProfile(null);
    }
  };

  const fetchConversationMessages = async (conversationId) => {
    try {
      setLoadingMessages(true);
      setError(null);

      const response = await axios.get(`http://127.0.0.1:5001/messages/conversations/${conversationId}/messages`);
      setMessages(response.data.data || []);

      await axios.post(`http://127.0.0.1:5001/messages/conversations/${conversationId}/read`);
      await fetchInbox();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load conversation");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
    const matchedConversation = conversations.find((conversation) => conversation.conversation_id === conversationId);
    if (matchedConversation) {
      setRecipientProfile({
        person_id: matchedConversation.other_person_id,
        person_name: matchedConversation.other_person_name,
        person_email: matchedConversation.other_person_email,
      });
    }
  };

  const handleSendMessage = async () => {
    const body = draft.trim();
    if (!body) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      let conversationId = selectedConversationId;

      if (conversationId) {
        await axios.post(`http://127.0.0.1:5001/messages/conversations/${conversationId}/messages`, { body });
      } else {
        const targetPersonId = recipientProfile?.person_id || recipientId;
        if (!targetPersonId) {
          throw new Error("Select a recipient before sending a message");
        }

        const response = await axios.post("http://127.0.0.1:5001/messages/conversations", {
          recipient_person_id: Number(targetPersonId),
          body,
        });
        conversationId = response.data.data.conversation.conversation_id;
      }

      setDraft("");
      setSelectedConversationId(conversationId);
      await Promise.all([fetchInbox(), fetchConversationMessages(conversationId)]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const previewRecipient = activeRecipient?.person_name || activeRecipient?.other_person_name || activeRecipient?.person_email;

  const renderConversationList = () => {
    if (loadingInbox) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="260px">
          <CircularProgress sx={{ color: colors.greenAccent[500] }} />
        </Box>
      );
    }

    if (conversations.length === 0) {
      return (
        <Box
          sx={{
            backgroundColor: colors.primary[400],
            border: `1px solid ${colors.primary[300]}`,
            borderRadius: "18px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <Inbox style={{ width: 36, height: 36, color: colors.blueAccent[400] }} />
          <Box mt={2} color={colors.grey[100]} fontWeight={700}>
            No conversations yet
          </Box>
          <Box mt={1} color={colors.grey[300]} fontSize="0.9rem">
            Start with a researcher profile or select a collaborator from your network.
          </Box>
        </Box>
      );
    }

    return conversations.map((conversation) => {
      const isActive = conversation.conversation_id === selectedConversationId;

      return (
        <Box
          key={conversation.conversation_id}
          onClick={() => handleSelectConversation(conversation.conversation_id)}
          sx={{
            backgroundColor: isActive ? colors.primary[500] : colors.primary[400],
            border: `1px solid ${isActive ? colors.greenAccent[500] : colors.primary[300]}`,
            borderRadius: "16px",
            padding: "16px",
            cursor: "pointer",
            transition: "transform 0.2s ease, border-color 0.2s ease",
            mb: 1.5,
            "&:hover": {
              transform: "translateY(-1px)",
              borderColor: colors.greenAccent[500],
            },
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Box color={colors.grey[100]} fontWeight={700} fontSize="0.98rem">
                {conversation.other_person_name || conversation.other_person_email || "Unknown collaborator"}
              </Box>
              <Box color={colors.grey[300]} fontSize="0.82rem" mt={0.5} sx={{ maxWidth: "18rem" }}>
                {conversation.last_message_preview || "No messages yet"}
              </Box>
            </Box>
            {conversation.unread_count > 0 && (
              <Box
                sx={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: "999px",
                  backgroundColor: colors.greenAccent[500],
                  color: colors.grey[900],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                }}
              >
                {conversation.unread_count}
              </Box>
            )}
          </Box>
        </Box>
      );
    });
  };

  return (
    <Box m="20px">
      <Header title="Messages" subtitle="Direct conversations with collaborators" />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" },
          gap: "20px",
          mt: 3,
        }}
      >
        <Box
          sx={{
            background: `linear-gradient(180deg, ${colors.primary[400]} 0%, ${colors.primary[500]} 100%)`,
            borderRadius: "24px",
            border: `1px solid ${colors.primary[300]}`,
            padding: "20px",
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <MessageSquare style={{ width: 20, height: 20, color: colors.greenAccent[500] }} />
            <Box color={colors.grey[100]} fontWeight={800} letterSpacing="0.02em">
              Inbox
            </Box>
          </Box>
          {renderConversationList()}
        </Box>

        <Box
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: "24px",
            border: `1px solid ${colors.primary[300]}`,
            padding: "20px",
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {error && (
            <Box
              sx={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: colors.grey[100],
                borderRadius: "14px",
                px: 2,
                py: 1.5,
                mb: 2,
              }}
            >
              {error}
            </Box>
          )}

          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Box color={colors.grey[100]} fontSize="1.2rem" fontWeight={800}>
                {previewRecipient || "Select a conversation"}
              </Box>
              <Box color={colors.grey[300]} fontSize="0.85rem" mt={0.5}>
                {selectedConversation ? `Conversation ${selectedConversation.conversation_id}` : "Choose a thread or start a new one from a profile."}
              </Box>
            </Box>
            {recipientId && !selectedConversation && recipientProfile && (
              <Button
                variant="outlined"
                onClick={() => navigate(`/person/${recipientProfile.person_id}`)}
                sx={{
                  borderColor: colors.blueAccent[500],
                  color: colors.grey[100],
                }}
              >
                View profile
              </Button>
            )}
          </Box>

          <Divider sx={{ borderColor: colors.primary[300], my: 2 }} />

          {loadingMessages ? (
            <Box flex={1} display="flex" alignItems="center" justifyContent="center">
              <CircularProgress sx={{ color: colors.greenAccent[500] }} />
            </Box>
          ) : messages.length === 0 ? (
            <Box
              flex={1}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              color={colors.grey[300]}
            >
              <Sparkles style={{ width: 40, height: 40, color: colors.blueAccent[400], marginBottom: 12 }} />
              <Box fontWeight={700} color={colors.grey[100]} mb={1}>
                Ready to start the conversation
              </Box>
              <Box maxWidth="34rem">
                Messages are stored as direct conversation records, so replies stay grouped and easy to query later.
              </Box>
            </Box>
          ) : (
            <Box flex={1} display="flex" flexDirection="column" gap={1.5} overflow="auto" pr={1}>
              {messages.map((message) => {
                const isMine = String(message.sender_user_id) === String(localStorage.getItem("user_id"));

                return (
                  <Box
                    key={message.message_id}
                    sx={{
                      alignSelf: isMine ? "flex-end" : "flex-start",
                      maxWidth: "min(32rem, 90%)",
                      backgroundColor: isMine ? colors.blueAccent[700] : colors.primary[500],
                      color: colors.grey[100],
                      borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      px: 2,
                      py: 1.5,
                      border: `1px solid ${isMine ? colors.blueAccent[500] : colors.primary[300]}`,
                    }}
                  >
                    <Box fontWeight={700} fontSize="0.82rem" mb={0.5} color={colors.greenAccent[300]}>
                      {isMine ? "You" : message.sender_name || message.sender_email || "Collaborator"}
                    </Box>
                    <Box sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{message.body}</Box>
                    <Box mt={0.75} fontSize="0.72rem" color={colors.grey[300]}>
                      {new Date(message.created_at).toLocaleString()}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          <Divider sx={{ borderColor: colors.primary[300], my: 2 }} />

          <Box display="flex" gap={1.5} alignItems="flex-end">
            <TextField
              multiline
              minRows={3}
              fullWidth
              placeholder={activeRecipient ? `Write to ${previewRecipient || "this collaborator"}...` : "Pick a conversation or recipient first."}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={sending || (!selectedConversationId && !recipientId && !recipientProfile)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: colors.primary[500],
                  color: colors.grey[100],
                  borderRadius: "16px",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: colors.primary[300],
                },
                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: colors.greenAccent[500],
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={sending || !draft.trim() || (!selectedConversationId && !recipientId && !recipientProfile)}
              startIcon={<Send />}
              sx={{
                minWidth: "9rem",
                minHeight: "3.5rem",
                borderRadius: "16px",
                fontWeight: 800,
                background: `linear-gradient(135deg, ${colors.greenAccent[500]} 0%, ${colors.blueAccent[500]} 100%)`,
                color: colors.grey[900],
                "&:hover": {
                  background: `linear-gradient(135deg, ${colors.greenAccent[400]} 0%, ${colors.blueAccent[400]} 100%)`,
                },
              }}
            >
              {sending ? "Sending" : "Send"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Messages;