export const users = [
  {
    _id: "698b44ed799ef25572dbbbb5",
    user_id: "whatsapp:+96171306344",
    active_image_url: "https://drive.google.com/uc?export=download&id=1ZnRwKCydVpbTFwZdyEHJOfYVd_JIFHRi",
    image_activated_at: "2026-02-13T22:37:58.654Z",
  },
  {
    _id: "698b44ed799ef25572dbbbb6",
    user_id: "whatsapp:+96170337005",
    active_image_url: "https://drive.google.com/uc?export=download&id=1SiT47FAM_AoSMhiu7jM4ysykerUxWVX4",
    image_activated_at: "2026-02-16T08:11:12.241Z",
  },
  {
    _id: "698b44ed799ef25572dbbbb7",
    user_id: "whatsapp:+96176765432",
    active_image_url: "https://drive.google.com/uc?export=download&id=1LrDFMba6jJbQ7S_P8UVhBpP8m8w9D9ed",
    image_activated_at: "2026-02-12T16:05:33.980Z",
  },
  {
    _id: "698b44ed799ef25572dbbbb8",
    user_id: "whatsapp:+96181444555",
    active_image_url: "https://drive.google.com/uc?export=download&id=1dvYcY3x8YH1t39BB85wkoM89Rk5FSP57",
    image_activated_at: "2026-02-15T14:20:02.010Z",
  },
];

export const chats = [
  {
    _id: "697612b752109c17d192b542",
    sessionId: "whatsapp:+96170337005",
    messages: [
      {
        type: "human",
        data: { content: "Hello, I need a purple dress." },
        datetime: "2026-02-15T11:30:00",
        execution_id: "exec_abc120",
      },
      {
        type: "ai",
        data: {
          content:
            "[Used tools: Tool: search_products, Input: { color: 'purple' }, Result: [{ id: 'p11' }]] The Eclipse Rose Dress is available in Purple and Black.",
        },
        datetime: "2026-02-15T11:30:05",
        execution_id: "exec_abc120",
      },
      {
        type: "human",
        data: { content: "Show me something with long sleeves." },
        datetime: "2026-02-16T11:20:12",
        execution_id: "exec_abc121",
      },
      {
        type: "ai",
        data: {
          content: "Sure, I found three long-sleeve options in your requested color range.",
        },
        datetime: "2026-02-16T11:21:01",
        execution_id: "exec_abc121",
      },
    ],
  },
  {
    _id: "697612b752109c17d192b543",
    sessionId: "whatsapp:+96181444555",
    messages: [
      {
        type: "human",
        data: { content: "Can you generate an image with an orange scarf?" },
        datetime: "2026-02-15T09:50:10",
        execution_id: "exec_orange_01",
      },
      {
        type: "ai",
        data: {
          content:
            "[Used tools: Tool: image_generator, Input: { scarf: 'orange' }, Result: { image_id: 'img_445' }]] Image generated. I can adjust style if you want.",
        },
        datetime: "2026-02-15T09:50:45",
        execution_id: "exec_orange_01",
      },
    ],
  },
  {
    _id: "697612b752109c17d192b544",
    sessionId: "whatsapp:+96171306344",
    messages: [
      {
        type: "human",
        data: { content: "I want a formal black outfit." },
        datetime: "2026-02-13T10:30:00",
        execution_id: "exec_abc123",
      },
      {
        type: "ai",
        data: {
          content:
            "[Used tools: Tool: search_products, Input: { style: 'formal' }, Result: [{ id: 'f01' }]] I found two formal black outfit options in stock.",
        },
        datetime: "2026-02-13T10:30:05",
        execution_id: "exec_abc123",
      },
      {
        type: "human",
        data: { content: "Great, can you save option one?" },
        datetime: "2026-02-14T13:10:00",
        execution_id: "exec_abc124",
      },
      {
        type: "ai",
        data: { content: "Done. Option one has been saved to your profile." },
        datetime: "2026-02-14T13:10:09",
        execution_id: "exec_abc124",
      },
    ],
  },
  {
    _id: "697612b752109c17d192b545",
    sessionId: "whatsapp:+96176765432",
    messages: [
      {
        type: "human",
        data: { content: "What sizes are available for the Luna blazer?" },
        datetime: "2026-02-12T08:41:00",
        execution_id: "exec_size_11",
      },
      {
        type: "ai",
        data: {
          content: "The Luna blazer is currently available in sizes S, M, and L.",
        },
        datetime: "2026-02-12T08:41:22",
        execution_id: "exec_size_11",
      },
    ],
  },
];
