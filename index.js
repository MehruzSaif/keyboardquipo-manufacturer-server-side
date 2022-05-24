const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xdlgt.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    const partCollection = client.db('keyboardquipo').collection('parts');
    const bookingCollection = client.db('keyboardquipo').collection('bookings');
    const userCollection = client.db('keyboardquipo').collection('users');

    // read all data of parts
    app.get('/part', async (req, res) => {
      const query = {};
      const cursor = partCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
    });

    // find one data of part by query
    app.get('/part/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const part = await partCollection.findOne(query);
      res.send(part);
    });


    app.get('/booking', async(req, res) => {
      const buyer = req.query.buyer;
      const query = {buyer: buyer};
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    })


    app.post('/booking', async(req, res) => {
      const booking = req.body;
      const result = bookingCollection.insertOne(booking);
      res.send(result);
    })

    app.put('/user/:email', async(req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })

    /* // POST
    app.post('/part', async (req, res) => {
      const newItem = req.body;
      const result = await partCollection.insertOne(newItem);
      res.send(result);
    }); */


    /* // Update quantity
    app.put("/part/:id", async (req, res) => {
      const id = req.params.id;
      const {placedOrder} = req.body;
      console.log("hello", placedOrder);
      const filter = { _id: ObjectId(id) };
      // const options = { upsert: true };
      const updateDocument = {
        $set: {placedOrder: placedOrder}
      };
      const result = await partCollection.updateOne(
        filter,
        updateDocument,
        // options
      );
      console.log("updating", id);
      console.log(result);
      if (result.acknowledged == true) {
        res.send({"Success": true, "msg": 'Order placed successfully'})
      }
    }); */

    // Update quantity
    app.put("/part/:id", async (req, res) => {
      const id = req.params.id;
      const purchase = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDocument = {
        $set: purchase
      };
      const result = await partCollection.updateOne(
        filter,
        updateDocument,
        options
      );
      console.log("updating", id);
      res.send(result);
    });

  }
  finally {

  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Keyboarquipo!')
})

app.listen(port, () => {
  console.log(`Keyboardquipo app listening on port ${port}`)
})