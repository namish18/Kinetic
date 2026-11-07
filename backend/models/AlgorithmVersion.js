
import mongoose from 'mongoose';

const algorithmVersionSchema = new mongoose.Schema(
    {
        version: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        configuration: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        isActive: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model(
    'AlgorithmVersion',
    algorithmVersionSchema
);
