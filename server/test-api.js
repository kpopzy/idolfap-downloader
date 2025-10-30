import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Cypress Pop API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    console.log('');

    // Test idols endpoint
    console.log('2. Testing idols endpoint...');
    const idolsResponse = await fetch(`${BASE_URL}/idols`);
    const idolsData = await idolsResponse.json();
    console.log('✅ Available idols:', idolsData);
    console.log('');

    // Test creators endpoint
    console.log('3. Testing creators endpoint...');
    const creatorsResponse = await fetch(`${BASE_URL}/creators`);
    const creatorsData = await creatorsResponse.json();
    console.log('✅ Available creators:', creatorsData);
    console.log('');

    // Test download status endpoint
    console.log('4. Testing download status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/downloads/jihyo`);
    const statusData = await statusResponse.json();
    console.log('✅ Download status for jihyo:', statusData);
    console.log('');

    console.log('🎉 All API tests passed!');
    console.log('\n📝 Usage examples:');
    console.log('📥 Download idols:');
    console.log('curl -X POST http://localhost:3000/download \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"idolName": "jihyo", "start": 1, "end": 2}\'');
    console.log('');
    console.log('📥 Download single post:');
    console.log('curl -X POST http://localhost:3000/download/single \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"postUrl": "https://idolfap.com/post/110673/"}\'');
    console.log('');
    console.log('📥 Download creator:');
    console.log('curl -X POST http://localhost:3000/download/creator \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"creatorName": "darkyeji"}\'');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 3000');
  }
}

testAPI(); 