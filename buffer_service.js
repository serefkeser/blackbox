// ============================================================================
// BUFFER SOCIAL MEDIA SERVICE (GraphQL API v2)
// ============================================================================

const BUFFER_GRAPHQL_ENDPOINT = 'https://api.buffer.com/graphql';

export class BufferService {
  static getAccessToken() {
    if (typeof window !== 'undefined' && window.SafeStorage) {
      return window.SafeStorage.getItem('BUFFER_API_KEY') || (typeof process !== 'undefined' ? process.env.BUFFER_API_KEY : '') || '';
    }
    return (typeof process !== 'undefined' ? process.env.BUFFER_API_KEY : '') || '';
  }

  static async graphqlQuery(query, variables = {}) {
    const token = this.getAccessToken();
    const isBrowser = typeof window !== 'undefined';
    const isHttpsRemote = isBrowser && window.location.protocol === 'https:' && 
      !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

    const endpoints = isBrowser ? [
      ...(!isHttpsRemote ? ['http://localhost:3000/buffer_proxy', 'http://127.0.0.1:3000/buffer_proxy'] : ['https://impotence-powdery-replace.ngrok-free.dev/buffer_proxy']),
      'https://corsproxy.org/?https://api.buffer.com/graphql',
      'https://api.buffer.com/graphql'
    ] : ['https://api.buffer.com/graphql'];

    let lastError = null;
    for (const ep of endpoints) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        if (ep.includes('/buffer_proxy')) {
          headers['X-Local-Proxy-Auth'] = 'otonom_proxy_secret_key_883921';
        }
        const res = await fetch(ep, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, token, variables })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.errors && json.errors.length > 0) {
            throw new Error(`Buffer GraphQL Error: ${json.errors[0].message}`);
          }
          return json.data;
        }
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Buffer API çağrısı başarısız oldu.');
  }

  // Kullanıcı Hesap & Organizasyon Bilgisi
  static async getAccount() {
    const query = `
      query {
        account {
          id
          email
          name
          organizations {
            id
            name
          }
        }
      }
    `;
    const data = await this.graphqlQuery(query);
    return data?.account;
  }

  // Bağlı Sosyal Medya Kanallarını Getir (Twitter/X, Instagram, LinkedIn vb.)
  static async getChannels() {
    const account = await this.getAccount();
    const orgId = account?.organizations?.[0]?.id || '69f5d86d8c5763cde0026fb0';
    
    const query = `
      query GetChannels($input: ChannelsInput!) {
        channels(input: $input) {
          id
          name
          service
        }
      }
    `;
    const data = await this.graphqlQuery(query, { input: { organizationId: orgId } });
    return data?.channels || [];
  }

  // Tek Bir Kanala Gönderi Yap (shareNow, addToQueue, customScheduled)
  static async createPost({ channelId, text, mode = 'shareNow', saveToDraft = false, assets = [] }) {
    const mutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post {
              id
              text
              status
            }
          }
          ... on InvalidInputError {
            message
          }
          ... on UnexpectedError {
            message
          }
        }
      }
    `;

    const inputObj = {
      channelId,
      text,
      mode,
      schedulingType: 'automatic',
      needsApproval: false,
      saveToDraft
    };

    if (Array.isArray(assets) && assets.length > 0) {
      inputObj.assets = assets;
    }

    const variables = { input: inputObj };
    const data = await this.graphqlQuery(mutation, variables);
    return data?.createPost;
  }

  // Tüm Bağlı Kanallara (Twitter, Instagram, TikTok vb.) Eşzamanlı Otomatik Paylaş
  static async postToAllChannels(text, mode = 'shareNow', assets = []) {
    const channels = await this.getChannels();
    if (!channels || channels.length === 0) {
      throw new Error('Buffer hesabına bağlı sosyal medya kanalı bulunamadı.');
    }

    const results = [];
    for (const ch of channels) {
      try {
        const res = await this.createPost({ channelId: ch.id, text, mode, assets });
        results.push({ channel: ch.name, service: ch.service, success: true, res });
      } catch (e) {
        results.push({ channel: ch.name, service: ch.service, success: false, error: e.message });
      }
    }
    return results;
  }
}
