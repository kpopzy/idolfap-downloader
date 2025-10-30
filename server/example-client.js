import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3000';

class CypressPopClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async getAvailableIdols() {
    const response = await fetch(`${this.baseUrl}/idols`);
    return response.json();
  }

  async getAvailableCreators() {
    const response = await fetch(`${this.baseUrl}/creators`);
    return response.json();
  }

  async startDownload(idolName, start, end) {
    const response = await fetch(`${this.baseUrl}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idolName,
        start: parseInt(start),
        end: parseInt(end)
      })
    });
    return response.json();
  }

  async downloadSinglePost(postUrl) {
    const response = await fetch(`${this.baseUrl}/download/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postUrl
      })
    });
    return response.json();
  }

  async downloadCreator(creatorName) {
    const response = await fetch(`${this.baseUrl}/download/creator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creatorName
      })
    });
    return response.json();
  }

  async getDownloadStatus(idolName) {
    const response = await fetch(`${this.baseUrl}/downloads/${idolName}`);
    return response.json();
  }
}

// Example usage
async function main() {
  const client = new CypressPopClient();

  try {
    console.log('🔍 Checking API health...');
    const health = await client.healthCheck();
    console.log('✅ Health:', health);

    console.log('\n📋 Getting available idols...');
    const idols = await client.getAvailableIdols();
    console.log('✅ Available idols:', idols);

    console.log('\n📋 Getting available creators...');
    const creators = await client.getAvailableCreators();
    console.log('✅ Available creators:', creators);

    console.log('\n📊 Checking download status for jihyo...');
    const status = await client.getDownloadStatus('jihyo');
    console.log('✅ Download status:', status);

    console.log('\n🚀 Starting a test idol download...');
    console.log('This will download pages 1-2 for jihyo (small test)');
    
    const downloadResult = await client.startDownload('jihyo', 1, 2);
    console.log('✅ Download result:', downloadResult);

    console.log('\n🚀 Starting a test single post download...');
    console.log('This will download a single post (small test)');
    
    const singleResult = await client.downloadSinglePost('https://idolfap.com/post/110673/');
    console.log('✅ Single post download result:', singleResult);

    console.log('\n🚀 Starting a test creator download...');
    console.log('This will download creator posts (small test)');
    
    const creatorResult = await client.downloadCreator('darkyeji');
    console.log('✅ Creator download result:', creatorResult);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the API server is running on port 3000');
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default CypressPopClient; 