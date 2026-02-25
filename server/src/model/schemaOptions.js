/* eslint-disable no-unused-vars */
const schemaOptions = {
  timestamps: true,
  versionKey: false, // removes __v entirely
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      const { _id, id, ...rest } = ret; // removes virtual id from rest
      return { id: _id, ...rest };
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret) => {
      const { _id, id, ...rest } = ret; // removes virtual id from rest
      return { id: _id, ...rest };
    },
  },
};

module.exports = schemaOptions;
