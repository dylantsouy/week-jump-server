'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ObservesRecord extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            ObservesRecord.belongsTo(models.Observe, {
                foreignKey: 'observeId',
                onDelete: 'CASCADE',
            });
        }
    }
    ObservesRecord.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            }, 
            date: {
                allowNull: false,
                type: DataTypes.DATE,
            },
            type: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 1,
                comment: '1: 觀察, 2: 稍微觀察, 3: 其他',
            },
            price: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            reason: {
                type: DataTypes.STRING,
            },
            observeId: {
                allowNull: false,
                type: DataTypes.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Observes',
                    key: 'id',
                    as: 'observeId',
                },
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'ObservesRecord',
        }
    );
    return ObservesRecord;
};
