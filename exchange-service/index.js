const express = require('express');
const app = express();
const PORT = 5003;

app.get('/', (req, res) => {
  res.send('Exchange Service is running');
});

app.listen(PORT, () => {
  console.log(`Exchange Service listening on port ${PORT}`);
});
