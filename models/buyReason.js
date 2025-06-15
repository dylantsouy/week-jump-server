'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class BuyReason extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            BuyReason.hasMany(models.TradingRecord, {
                foreignKey: 'buyReasonId',
                as: 'tradingRecords',
            });
        }
    }
    BuyReason.init(
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'BuyReason',
        }
    );
    return BuyReason;
};
