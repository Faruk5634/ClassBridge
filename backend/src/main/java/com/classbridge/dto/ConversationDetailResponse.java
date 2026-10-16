package com.classbridge.dto;

import java.util.List;

public class ConversationDetailResponse {
    private ConversationResponse conversation;
    private List<DirectMessageResponse> messages;

    public ConversationDetailResponse(ConversationResponse conversation, List<DirectMessageResponse> messages) {
        this.conversation = conversation;
        this.messages = messages;
    }
    public ConversationResponse getConversation() { return conversation; }
    public List<DirectMessageResponse> getMessages() { return messages; }
}
