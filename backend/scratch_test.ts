import axios from 'axios';

async function main() {
  const response = await axios.get('http://localhost:8080/instance/fetchInstances', {
    headers: { apikey: 'global_key' },
    params: { instanceId: 'cmqm0axuu0000io10r8mn332p' }
  });
  console.log('Response data length:', response.data.length);
  console.log('Response instances names:', response.data.map((i: any) => i.name));
}

main().catch(console.error);
