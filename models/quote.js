'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Quote extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    }
    Quote.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            sentence:{
                allowNull: false,
                type: DataTypes.STRING,
            },
            fromWho:{
                allowNull: true,
                type: DataTypes.STRING,
                defaultValue: '',
            },
            note:{
                allowNull: true,
                type: DataTypes.STRING,
                defaultValue: '',
            },
            type:{
                allowNull: true,
                type: DataTypes.STRING,
                defaultValue: '',
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: false,
            modelName: 'Quote',
        }
    );
    return Quote;
};
