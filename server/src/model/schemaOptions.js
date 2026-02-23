const schemaOptions = {
  timestamps: true,
  versionKey: false, // removes __v entirely
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      const { _id, ...rest } = ret;
      return { id: _id, ...rest };
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      const { _id, ...rest } = ret;
      return { id: _id, ...rest };
    },
  },
};

module.exports = schemaOptions;
