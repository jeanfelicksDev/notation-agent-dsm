const fetch = require('node-fetch');

async function test() {
  const campaignRes = await fetch('http://localhost:3002/api/admin/campagnes');
  const campaigns = await campaignRes.json();
  
  if (campaigns.length === 0) {
    console.log('No campaigns found');
    return;
  }
  
  const id = campaigns[0].id;
  console.log('Testing with campaign:', campaigns[0].libelle, 'ID:', id);
  
  const res = await fetch(`http://localhost:3002/api/admin/campagnes/${id}/criteres`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      libelle: 'Test Critère',
      description: 'Ceci est un test',
      noteMaximale: 5,
      typeEvaluateur: 'TOUS'
    })
  });
  
  const data = await res.json();
  console.log('Result:', data);
}

test();
