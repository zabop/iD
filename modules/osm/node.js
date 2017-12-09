import _extend from 'lodash-es/extend';
import _map from 'lodash-es/map';
import _some from 'lodash-es/some';

import { osmEntity } from './entity';
import { geoAngle, geoExtent } from '../geo';


export function osmNode() {
    if (!(this instanceof osmNode)) {
        return (new osmNode()).initialize(arguments);
    } else if (arguments.length) {
        this.initialize(arguments);
    }
}

osmEntity.node = osmNode;

osmNode.prototype = Object.create(osmEntity.prototype);

_extend(osmNode.prototype, {

    type: 'node',


    extent: function() {
        return new geoExtent(this.loc);
    },


    geometry: function(graph) {
        return graph.transient(this, 'geometry', function() {
            return graph.isPoi(this) ? 'point' : 'vertex';
        });
    },


    move: function(loc) {
        return this.update({loc: loc});
    },


    isDegenerate: function() {
        return !(
            Array.isArray(this.loc) && this.loc.length === 2 &&
            this.loc[0] >= -180 && this.loc[0] <= 180 &&
            this.loc[1] >= -90 && this.loc[1] <= 90
        );
    },


    // Inspect tags and geometry to determine which direction(s) this node/vertex points
    directions: function(resolver, projection) {
        var val;

        if (this.isHighwayIntersection(resolver) && (this.tags.stop || '').toLowerCase() === 'all') {
            // all-way stop tag on a highway intersection
            val = 'all';
        } else {
            // direction tag
            val = (
                this.tags['railway:signal:direction'] ||
                this.tags['traffic_signals:direction'] ||
                this.tags.direction ||
                ''
            ).toLowerCase();
        }

        // swap cardinal for numeric directions
        var cardinal = {
            north: 0,               n: 0,
            northnortheast: 22,     nne: 22,
            northeast: 45,          ne: 45,
            eastnortheast: 67,      ene: 67,
            east: 90,               e: 90,
            eastsoutheast: 112,     ese: 112,
            southeast: 135,         se: 135,
            southsoutheast: 157,    sse: 157,
            south: 180,             s: 180,
            southsouthwest: 202,    ssw: 202,
            southwest: 225,         sw: 225,
            westsouthwest: 247,     wsw: 247,
            west: 270,              w: 270,
            westnorthwest: 292,     wnw: 292,
            northwest: 315,         nw: 315,
            northnorthwest: 337,    nnw: 337
        };
        if (cardinal[val] !== undefined) {
            val = cardinal[val];
        }

        // if direction is numeric, return early
        if (val !== '' && !isNaN(+val)) {
            return [(+val)];
        }

        var lookBackward =
            (this.tags['traffic_sign:backward'] || val === 'backward' || val === 'both' || val === 'all');
        var lookForward =
            (this.tags['traffic_sign:forward'] || val === 'forward' || val === 'both' || val === 'all');

        if (!lookForward && !lookBackward) return null;

        var nodeIds = {};
        resolver.parentWays(this).forEach(function(parent) {
            var nodes = parent.nodes;
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i] === this.id) {  // match current entity
                    if (lookForward && i > 0) {
                        nodeIds[nodes[i - 1]] = true;  // look back to prev node
                    }
                    if (lookBackward && i < nodes.length - 1) {
                        nodeIds[nodes[i + 1]] = true;  // look ahead to next node
                    }
                }
            }
        }, this);

        return Object.keys(nodeIds).map(function(nodeId) {
            // +90 because geoAngle returns angle from X axis, not Y (north)
            return (geoAngle(this, resolver.entity(nodeId), projection) * (180 / Math.PI)) + 90;
        }, this);
    },


    isEndpoint: function(resolver) {
        return resolver.transient(this, 'isEndpoint', function() {
            var id = this.id;
            return resolver.parentWays(this).filter(function(parent) {
                return !parent.isClosed() && !!parent.affix(id);
            }).length > 0;
        });
    },


    isConnected: function(resolver) {
        return resolver.transient(this, 'isConnected', function() {
            var parents = resolver.parentWays(this);

            function isLine(entity) {
                return entity.geometry(resolver) === 'line' &&
                    entity.hasInterestingTags();
            }

            // vertex is connected to multiple parent lines
            if (parents.length > 1 && _some(parents, isLine)) {
                return true;

            } else if (parents.length === 1) {
                var way = parents[0],
                    nodes = way.nodes.slice();
                if (way.isClosed()) { nodes.pop(); }  // ignore connecting node if closed

                // return true if vertex appears multiple times (way is self intersecting)
                return nodes.indexOf(this.id) !== nodes.lastIndexOf(this.id);
            }

            return false;
        });
    },


    isIntersection: function(resolver) {
        return resolver.transient(this, 'isIntersection', function() {
            return resolver.parentWays(this).filter(function(parent) {
                return (parent.tags.highway ||
                    parent.tags.waterway ||
                    parent.tags.railway ||
                    parent.tags.aeroway) &&
                    parent.geometry(resolver) === 'line';
            }).length > 1;
        });
    },


    isHighwayIntersection: function(resolver) {
        return resolver.transient(this, 'isHighwayIntersection', function() {
            return resolver.parentWays(this).filter(function(parent) {
                return parent.tags.highway && parent.geometry(resolver) === 'line';
            }).length > 1;
        });
    },


    isOnAddressLine: function(resolver) {
        return resolver.transient(this, 'isOnAddressLine', function() {
            return resolver.parentWays(this).filter(function(parent) {
                return parent.tags.hasOwnProperty('addr:interpolation') &&
                    parent.geometry(resolver) === 'line';
            }).length > 0;
        });
    },


    asJXON: function(changeset_id) {
        var r = {
            node: {
                '@id': this.osmId(),
                '@lon': this.loc[0],
                '@lat': this.loc[1],
                '@version': (this.version || 0),
                tag: _map(this.tags, function(v, k) {
                    return { keyAttributes: { k: k, v: v } };
                })
            }
        };
        if (changeset_id) r.node['@changeset'] = changeset_id;
        return r;
    },


    asGeoJSON: function() {
        return {
            type: 'Point',
            coordinates: this.loc
        };
    }
});
