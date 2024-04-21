'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Target extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Target.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                onDelete: 'NO ACTION',
            });
            Target.hasMany(models.News, {
                foreignKey: 'targetId',
                onUpdate: 'CASCADE',
            });
        }
    }
    Target.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            rate: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 5,
                comment:
                    '1: 持有, 2: 看好, 3: 有機會, 4: 需等待, 5: 待觀察, 6: 中立, 7: 已反應, 8: 有風險, 9: 中立偏空, 10: 不看好',
            },
            initPrice: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            sort:{
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            eps:{
                type: DataTypes.JSON,
            },
            avergePE:{
                type: DataTypes.STRING,
            },
            CAGR:{
                type: DataTypes.STRING,
            },
            yield:{
                type: DataTypes.STRING,
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
            modelName: 'Target',
        }
    );
    return Target;
};
