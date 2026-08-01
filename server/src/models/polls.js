const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

function col() {
  return getDb().collection('polls');
}

async function createPoll({ boardId, question, options, closesAt }) {
  const doc = {
    boardId: new ObjectId(boardId),
    question,
    options: options.map((text) => ({ text, votes: [] })),
    closesAt: new Date(closesAt),
    createdAt: new Date(),
  };
  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function findByBoard(boardId) {
  return col().find({ boardId: new ObjectId(boardId) }).sort({ createdAt: -1 }).toArray();
}

async function findPollById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

/**
 * Cast or change a vote. Removes user from all options first, then adds to chosen option.
 */
async function vote(pollId, userId, optionIndex) {
  const userOid = new ObjectId(userId);
  const poll = await findPollById(pollId);
  if (!poll) return null;

  // Remove user from all options
  for (let i = 0; i < poll.options.length; i++) {
    poll.options[i].votes = poll.options[i].votes.filter(
      (v) => v.toString() !== userOid.toString()
    );
  }

  // Add user to chosen option
  if (optionIndex >= 0 && optionIndex < poll.options.length) {
    poll.options[optionIndex].votes.push(userOid);
  }

  await col().updateOne(
    { _id: new ObjectId(pollId) },
    { $set: { options: poll.options } }
  );

  return findPollById(pollId);
}

module.exports = { createPoll, findByBoard, findPollById, vote };
