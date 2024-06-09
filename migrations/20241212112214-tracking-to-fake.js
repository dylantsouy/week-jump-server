'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Trackings', 'sort');
        await queryInterface.removeColumn('Trackings', 'date');
        await queryInterface.removeColumn('Trackings', 'content');
        await queryInterface.removeColumn('Trackings', 'fromWhere');
        await queryInterface.removeColumn('Trackings', 'type');
        await queryInterface.removeColumn('Trackings', 'newsId');
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn('Trackings', 'sort', {
            allowNull: false,
            type: Sequelize.INTEGER,
        });
        await queryInterface.addColumn('Trackings', 'date', {
            allowNull: false,
            type: Sequelize.DATE,
        });
        await queryInterface.addColumn('Trackings', 'content', {
            allowNull: true,
            type: Sequelize.TEXT,
        });
        await queryInterface.addColumn('Trackings', 'fromWhere', {
            allowNull: true,
            type: Sequelize.STRING,
        });
        await queryInterface.addColumn('Trackings', 'type', {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 1,
            comment: '1: 利多, 2: 利空, 3: 中立',
        });
        await queryInterface.addColumn('Trackings', 'newsId', {
            allowNull: false,
            type: Sequelize.UUID,
            onDelete: 'CASCADE',
            references: {
                model: 'News',
                key: 'id',
                as: 'newsId',
            },
        });
    },
};'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Tracking extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    }
    Tracking.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'Tracking',
        }
    );
    return Tracking;
};
