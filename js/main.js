
  const API_KEY = 'app-xxxxx';
  const SUPABASE_URL = 'https://dynltxxxxxxx.supabase.co';
  const SUPABASE_KEY = 'xxx';
  const USER_ID = 'user-001';
  let conversationId = '';

  const BOT_ICON_URL = 'assets/bot-icon.png'; // ローカルパスに変更


  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const chatLog = document.getElementById('chatLog');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');

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
      wrapper.appendChild(message); // ユーザー側はアイコンなし
    }

    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
    return message;
  }

  sendBtn.onclick = async () => {
    const query = inputBox.value.trim();
    if (!query) return;

    addMessage(query, 'user');
    inputBox.value = '';

    const botDiv = addMessage('...', 'bot');

    let loadingDots = 0;
    let animationRunning = true;
    const animInterval = setInterval(() => {
      if (!animationRunning) return;
      loadingDots = (loadingDots + 1) % 4;
      botDiv.textContent = '入力中' + '.'.repeat(loadingDots);
    }, 400);

    try {
      const response = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          user: USER_ID,
          response_mode: 'streaming',
          conversation_id: conversationId || undefined,
          inputs: {}
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botReply = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        chunk.split('\n').forEach(line => {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));

              if (data.answer) {
                if (animationRunning) {
                  animationRunning = false;
                  clearInterval(animInterval);
                }

                botReply += data.answer;
                botDiv.textContent = botReply;
                chatLog.scrollTop = chatLog.scrollHeight;
              }

              if (data.conversation_id) {
                conversationId = data.conversation_id;
              }
            } catch (e) {
              console.warn('JSON parse error:', e);
            }
          }
        });
      }

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
      animationRunning = false;
      clearInterval(animInterval);
      botDiv.textContent = '通信エラー: ' + error.message;
    }

    chatLog.scrollTop = chatLog.scrollHeight;
  };

  inputBox.addEventListener("keydown", function(event) {
    if (event.key === "Enter") sendBtn.click();
  });

