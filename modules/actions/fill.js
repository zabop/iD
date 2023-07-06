import { osmNode } from '../osm/node';
import { utilArrayUniq } from '../util';


export function actionFill(wayId, projection, maxAngle) {

    var locs = [
        [ 5.49735895, 58.75292647 ],
        [ 5.49781611, 58.75269445 ],
        [ 5.49725021, 58.75235475 ],
        [ 5.49794215, 58.75230603 ],
        [ 5.49835978, 58.75262010 ],
        [ 5.49804594, 58.75293673 ],
        [ 5.49770738, 58.75304055 ],
        [ 5.49735895, 58.75292647 ]
    ]

    var action = function(graph, t) {
        if (t === null || !isFinite(t)) t = 1;
        t = Math.min(Math.max(+t, 0), 1);

        var way = graph.entity(wayId);
        var origNodes = {};

        graph.childNodes(way).forEach(function(node) {
            if (!origNodes[node.id]) origNodes[node.id] = node;
        });

        var nodes = utilArrayUniq(graph.childNodes(way));

        var p, q, node, loc
        var inBetweenNodes = [];

        const cc = nodes.length
        for (p = 0; p < (locs.length-cc); p++) {
            node = osmNode({ loc: locs[p] });
            nodes.splice(p, 0, node);
            inBetweenNodes.push(node.id);
        }
        for (q = 0; q < locs.length; q++) {

            node = nodes[q];
            node = node.move(locs[q]);
            graph = graph.replace(node);
        }

        ids = nodes.map(function(n) { return n.id; });
        ids.push(ids[0]);

        way = way.update({nodes: ids});
        graph = graph.replace(way);

        return graph;
    };

    action.disabled = function(graph) {
        if (!graph.entity(wayId).isClosed()) {
            return 'not_closed';
        }
    };

    action.transitionable = true;

    return action;
}
