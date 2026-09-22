'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const addDays = (value, days) => {
	const date = new Date(value);
	date.setDate(date.getDate() + days);
	return date.toISOString().slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

const userFilter = (user) => ({ user: { documentId: user.documentId } });

module.exports = createCoreController('api::profiler.profiler', ({ strapi }) => ({
	async latest(ctx) {
		const records = await strapi.documents('api::profiler.profiler').findMany({
			filters: userFilter(ctx.state.user),
			sort: ['dueDate:desc', 'createdAt:desc'],
			populate: { specifics: true },
			limit: 1,
		});

		let record = records[0];
		if (!record) {
			record = await strapi.documents('api::profiler.profiler').create({
				data: {
					user: ctx.state.user.documentId,
					dueDate: addDays(new Date(), 7),
				},
				populate: { specifics: true },
			});
		}

		return { data: record };
	},

	async responses(ctx) {
		const records = await strapi.documents('api::profiler.profiler').findMany({
			filters: {
				...userFilter(ctx.state.user),
				dateComplete: { $notNull: true },
			},
			sort: ['dateComplete:desc'],
			populate: { specifics: true },
		});

		return { data: records };
	},

	async submit(ctx) {
		const payload = ctx.request.body?.data || ctx.request.body || {};
		const dueDate = payload.dueDate || today();
		const result = payload.result;
		const data = {
			result,
			dueDate,
			concernAreas: payload.concernAreas || null,
			reason: payload.reason || null,
			reminderDate: payload.reminderDate || null,
			dateComplete: result === 'complete' || result === 'refused' ? today() : null,
			user: ctx.state.user.documentId,
		};

		if (result === 'postponed') {
			data.reminderDate = payload.reminderDate || addDays(new Date(), 3);
		}

		const existing = payload.profilerId
			? [await strapi.documents('api::profiler.profiler').findOne(payload.profilerId, { populate: { user: true } })]
			: await strapi.documents('api::profiler.profiler').findMany({
					filters: { ...userFilter(ctx.state.user), dueDate },
					limit: 1,
				});

		if (existing[0] && existing[0].user && existing[0].user.documentId !== ctx.state.user.documentId) {
			ctx.forbidden('This profiler record does not belong to the current user.');
		}

		const specificIds = [];
		for (const concern of Array.isArray(payload.specifics) ? payload.specifics : []) {
			const matches = await strapi.documents('api::concern-specific.concern-specific').findMany({
				filters: { concern },
				limit: 1,
			});
			if (matches[0]) specificIds.push(matches[0].documentId);
		}

		if (existing[0]) {
			const updated = await strapi.documents('api::profiler.profiler').update(existing[0].documentId, {
				data: {
					...data,
					dueDate: result === 'postponed' ? dueDate : null,
					specifics: { set: specificIds },
				},
				populate: { specifics: true },
			});

			if (result === 'complete' || result === 'refused') {
				await strapi.documents('api::profiler.profiler').create({
					data: {
						user: ctx.state.user.documentId,
						dueDate: addDays(new Date(), 91),
					},
				});
			}

			return { data: updated };
		}

		const created = await strapi.documents('api::profiler.profiler').create({
			data: { ...data, specifics: { connect: specificIds } },
			populate: { specifics: true },
		});

		return { data: created };
	},
}));
