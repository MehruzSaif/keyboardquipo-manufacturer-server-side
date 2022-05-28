const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xdlgt.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const partCollection = client.db('keyboardquipo').collection('parts');
    const bookingCollection = client.db('keyboardquipo').collection('bookings');
    const userCollection = client.db('keyboardquipo').collection('users');
    const paymentCollection = client.db('keyboardquipo').collection('payments');
    const reviewCollection = client.db('keyboardquipo').collection('reviews');
    const profileCollection = client.db('keyboardquipo').collection('profiles');
    /* const equipmentCollection = client.db('keyboardquipo').collection('equipments'); */

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else {
        res.status(403).send({ message: 'Forbidden access' })
      }
    }

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


    app.get('/booking', verifyJWT, async (req, res) => {
      const buyer = req.query.buyer;
      const decodedEmail = req.decoded.email;
      if (buyer === decodedEmail) {
        const query = { buyer: buyer };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      }
      else {
        return res.status(403).send({ message: 'forbidden access' });
      }
    })

    // payment for particular id
    app.get('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    })

    // for exchanging currency API
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret })
    });

    // for booking post
    app.post('/booking', async (req, res) => {
      const {price, quantity, buyer, partName } = req.body;
      let order = {"buyer": buyer, "partName": partName, "price": price, "quantity": quantity, "paid": false}
      const result = bookingCollection.insertOne(order);
      res.send(result);
    })

    // booking patch for update
    app.patch('/booking/:id', verifyJWT, async(req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,  
        }
      }

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc)

    })

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    // only for admin
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    })

    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    });

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ result, token });
    });


    // for manage part for admin
    app.get('/part', verifyJWT, verifyAdmin, async (req, res) => {
      const equipments = await partCollection.find().toArray();
      res.send(equipments);
    })


    // for addPart collection for admin
    app.post('/part', verifyJWT, verifyAdmin, async (req, res) => {
      const equipment = req.body;
      const result = await partCollection.insertOne(equipment);
      res.send(result);
    })


    // for delete part for admin
    app.delete('/part/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await partCollection.deleteOne(filter);
      res.send(result);
    })


    // for add review collection for user
    app.post('/review', verifyJWT, async (req, res) => {
      const comment = req.body;
      const result = await reviewCollection.insertOne(comment);
      res.send(result);
    })

    // read all data of reviews
    app.get('/review', async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });


    //// user can cancel booking
    app.delete('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await bookingCollection.deleteOne(filter);
      res.send(result);
    })

    // for add profile collection for user and admin
    app.post('/profile', async (req, res) => {
      const profile = req.body;
      const result = await profileCollection.insertOne(profile);
      res.send(result);
    })


    // for get profile
    app.get('/profile/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const result = await profileCollection.findOne(filter);
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