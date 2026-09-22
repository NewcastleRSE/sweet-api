'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::tunnel.tunnel', ({ strapi }) => ({
	async schema(ctx) {
		const records = await strapi.documents('api::tunnel.tunnel').findMany({
			fields: ['slug', 'routes'],
			populate: { users: { fields: ['documentId'] } },
		});
		const completed = records
			.filter((record) => record.users?.some((user) => user.documentId === ctx.state.user.documentId))
			.map((record) => record.slug);

		return {
			data: records.map(({ slug, routes }) => ({ slug, routes: routes || [] })),
			completed,
		};
	},

	async complete(ctx) {
		const tunnel = await strapi.documents('api::tunnel.tunnel').findFirst({
			filters: { slug: ctx.params.slug },
		});

		if (!tunnel) return ctx.notFound('Tunnel not found.');

		const updated = await strapi.documents('api::tunnel.tunnel').update(tunnel.documentId, {
			data: { users: { connect: [ctx.state.user.documentId] } },
		});

		return { data: updated };
	},
}));
