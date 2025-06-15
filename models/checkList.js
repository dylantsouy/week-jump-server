'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CheckList extends Model {
        static associate(models) {
            // CheckList has many TradingRecordCheckLists
            CheckList.hasMany(models.TradingRecordCheckList, {
                foreignKey: 'checkListId',
                as: 'tradingRecords',
            });

            // CheckList belongs to many TradingRecords through TradingRecordCheckList
            CheckList.belongsToMany(models.TradingRecord, {
                through: models.TradingRecordCheckList,
                foreignKey: 'checkListId',
                otherKey: 'tradingRecordId',
                as: 'tradingRecordItems',
            });
        }

        // 取得使用次數
        async getUsageCount() {
            const TradingRecordCheckList = sequelize.models.TradingRecordCheckList;
            return await TradingRecordCheckList.count({
                where: { checkListId: this.id },
            });
        }

        // 是否可以刪除
        async canDelete() {
            const usageCount = await this.getUsageCount();
            return usageCount === 0;
        }
    }

    CheckList.init(
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
                validate: {
                    len: [1, 100],
                },
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            sortOrder: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            modelName: 'CheckList',
            timestamps: true,
            paranoid: true, // 支援軟刪除
            indexes: [
                {
                    fields: ['isActive'],
                },
                {
                    fields: ['sortOrder'],
                },
                {
                    fields: ['name'],
                    unique: true,
                },
            ],
            defaultScope: {
                order: [
                    ['sortOrder', 'ASC'],
                    ['name', 'ASC'],
                ],
            },
            scopes: {
                active: {
                    where: { isActive: true },
                },
                inactive: {
                    where: { isActive: false },
                },
            },
        }
    );

    return CheckList;
};
