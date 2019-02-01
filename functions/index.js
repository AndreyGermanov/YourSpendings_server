const functions = require('firebase-functions');
const admin = require('firebase-admin');
const _ = require('lodash');
admin.initializeApp();
const db = admin.firestore();


exports.listShops = functions.https.onRequest((request, response) => {
    list(request,response,"shops");
});

exports.listPurchases = functions.https.onRequest((request, response) => {
    list(request,response,"purchases");
});

exports.listDeleted = functions.https.onRequest((request, response) => {
    list(request, response, "deleted");
});

const list = (request,response,collection) => {
    auth(request,(err,uid) => {
        if (err) { response.status(400).send(err); return;}
        getList(collection,uid, (err,list) => {
            if (err) { response.status(500).send(err); return }
            response.status(200).send(JSON.stringify(list))
        })
    })
};

const getList = (collection,uid,callback) => {
    let list = [];
    db.collection(collection).where("user_id","==",uid).get().then(snapshot => {
        snapshot.forEach(doc => {
            list.push(doc.data())
        });
        callback(null,list);
        return null;
    }).catch(err => {
        callback(err);
    })
};

const auth = (request,callback) => {
    if (!request.headers.authorization || !request.headers.authorization.startsWith('Bearer ')) {
        callback("Unauthorized request");
        return
    }
    callback(null,request.headers.authorization.split('Bearer ')[1]);
};

exports.setPurchaseUpdatedAt = functions.firestore.document("purchases/{id}").onWrite((change) => {
    return processChange("purchases",change);
});

exports.setPlaceUpdatedAt = functions.firestore.document("shops/{id}").onWrite((change) => {
    return processChange("shops",change);
});

const processChange = (collection,change) => {
    return change.after.exists ? processUpdate(change) : processDelete(collection,change.before.data());
};

const processUpdate = (change) => {
    if (change.before.exists) {
        const afterData = _.cloneDeep(change.after.data());
        afterData["updated_at"] = 0;
        const beforeData = _.cloneDeep(change.before.data());
        beforeData["updated_at"] = 0;
        if (_.isEqual(beforeData, afterData)) return null;
    }
    return change.after.ref.set({
        updated_at: Math.floor(new Date().getTime() / 1000)
    }, {merge: true})
};

const processDelete = (collection,data) => {
    db.collection("deleted").add({
        collection:collection,
        id: data.id,
        user_id: data.user_id,
        updated_at: Math.floor(new Date().getTime() / 1000)
    })
};