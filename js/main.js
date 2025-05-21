const SUPABASE_URL = 'https://rrdjjpgfafzxfrtlnzqs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZGpqcGdmYWZ6eGZydGxuenFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MjY2NTgsImV4cCI6MjA2MjMwMjY1OH0.UhoXjzCoKbfxnypm0-ADn-CG5GgDMcYlB9Ya4aNhmhA';
const PROXY_URL = 'https://dify-proxy-api.onrender.com/chat';

const USER_ID = localStorage.getItem('user_id') || (() => {
  const id = 'user-' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('user_id', id);
  return id;
})();

const BOT_ICON_URL = 'assets/bot-icon.png';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const chatLog = document.getElementById('chatLog');
const inputBox = document.getElementById('inputBox');
const sendBtn = document.getElementById('sendBtn');
let conversationId = '';

function addMessage(text, type = 'bot') {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${type}`;

  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;

  if (type === 'bot') {
    const icon = document.createElement('img');
    icon.className = 'icon';
    icon.src = BOT_ICON_URL;
    wrapper.appendChild(icon);
    wrapper.appendChild(message);
  } else {
    wrapper.appendChild(message);
  }

  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
  return message;
}

async function displayChatHistoryList() {
  const { data, error } = await supabaseClient
    .from('chat_logs')
    .select('*')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('履歴取得エラー:', error);
    return;
  }

  const historyContainer = document.createElement('div');
  historyContainer.style.padding = '12px';
  historyContainer.style.background = '#fff8dc';
  historyContainer.style.borderBottom = '1px solid #ccc';

  const title = document.createElement('h3');
  title.textContent = '📋 チャット履歴';
  historyContainer.appendChild(title);

  data.forEach(entry => {
    const qa = document.createElement('div');
    qa.style.marginBottom = '10px';
    qa.innerHTML = `<strong>Q:</strong> ${entry.question}<br><strong>A:</strong> ${entry.answer}`;
    historyContainer.appendChild(qa);
  });

  document.body.insertBefore(historyContainer, chatLog);
}

async function loadChatHistory() {
  const { data, error } = await supabaseClient
    .from('chat_logs')
    .select('*')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('履歴取得エラー:', error);
    return;
  }

  data.forEach(entry => {
    addMessage(entry.question, 'user');
    addMessage(entry.answer, 'bot');
  });
}

sendBtn.onclick = async () => {
  const query = inputBox.value.trim();
  if (!query) return;

  addMessage(query, 'user');
  inputBox.value = '';

  const botDiv = addMessage('...', 'bot');

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        user: USER_ID,
        response_mode: 'blocking',
        conversation_id: conversationId || undefined,
        inputs: {}
      })
    });

    const result = await response.json();
    const botReply = result.answer || '（返答がありません）';

    botDiv.textContent = botReply;
    chatLog.scrollTop = chatLog.scrollHeight;

    const { error } = await supabaseClient.from('chat_logs').insert([
      {
        user_id: USER_ID,
        question: query,
        answer: botReply
      }
    ]);
    if (error) {
      console.error('Supabase保存エラー:', error);
      botDiv.textContent += '\n(保存エラー)';
    }

  } catch (error) {
    botDiv.textContent = '通信エラー: ' + error.message;
  }

  chatLog.scrollTop = chatLog.scrollHeight;
};

inputBox.addEventListener("keydown", function(event) {
  if (event.key === "Enter") sendBtn.click();
});

window.addEventListener('DOMContentLoaded', () => {
  displayChatHistoryList();
  loadChatHistory();
});
