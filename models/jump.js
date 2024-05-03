'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Jump extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Jump.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                onDelete: 'NO ACTION',
            });
            Jump.hasMany(models.JumpsRecord, {
                foreignKey: 'jumpId',
                onUpdate: 'CASCADE',
            });
        }
    }
    Jump.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            stockCode: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'Jump',
        }
    );
    return Jump;
};
