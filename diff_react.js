// From 《虚拟 DOM 到底是什么？》：https://juejin.im/post/6844903870229905422

class Component {
    vdom = null;
    $el = null;

    state = {
        text: 'Initialize the Component'
    }

    setState(newState) {
        this.state = {
            ...this.state,
            ...newState
        }
        const nesVdom = this.render()
        const patches = diff(this.vdom, nesVdom)
        patch(this.$el, patches)
    }

    changeText(text) {
        thissetState({
            text
        })
    }

    render() {
        const { text } = this.state
        return (
            <div>{ text }</div> // 这里的``是不存在的，为了高亮所以故意搞的
        )
    }
}

function createElement(app, component) {
    const vdom = component.render()
    component.vdom = vdom
    component.$el = render(vdom) // 将虚拟DOM转换为真实DOM
    app.appendChild(component.$el)
}

const app = document.getElementById('app')
const component = new Component
createElement(app, component)


// diff 算法
const before = h('div', {}, 'before text')
const after = h('div', {}, 'after text')

const patches = diff(before, after)


function diff(oldNode, newNode) {
    const patches = []
    walk(oldNode, newNode, patches, 0) // 进行深度优先遍历
    return patches
}

function walk(oldNode, newNode, patches, index) {
    if (newNode === oldNode) return

    const patch = { type: 'update', vNode: newNode }

    const oldChidren = oldNode.children
    const newChildren = newNode.children
    const oldLen = oldChidren.length
    const newLen = newChildren.length
    const len = oldLen > newLen ? oldLen : newLen
    // 找到对应位置的子节点进行比对
    for (let i = 0; i < len; i++) {
        const oldChild = oldChidren[i]
        const newChild = newChildren[i]
        index++
        // 相同节点进行比对
        walk(oldChild, newChild, patches, index)
        if (isArray(oldChild.children)) {
            index += oldChild.children.length
        }
    }

    if (patch) {
        patches[index] = patch
    }
}
// 具体的walk实现
function walk(oldNode, newNode, patches, index) {
    if (newNode === oldNode) return

    let patch = patched[index]

    if (!oldNode) {
        // 旧节点不存在，直接插入
        patch = appendPatch(patch, {
            type: PATCH.INSERT,
            vNode: newNode,
        })
    } else if (!newNode) {
        // 新节点不存在，删除旧节点
        patch = appendPatch(patch, {
            type: PATCH.REMOVE,
            vNode: null
        })
    } else if (isVNode(newNode)) {
        if (isVNode(oldNode)) {
            // 相同类型节点的diff
            if (newNode.tag === oldNode.tag && newNode.key === oldNode.key) {
                // 新老节点属性的对比
                const propsPatch = diffProps(newNode.props, oldNode.props)
                if (propsPatch && propsPatch.length > 0) {
                    patch = appendPatch(patch, {
                        type: PATCH.PROPS,
                        patches: propsPatch
                    })
                }
                // 新老节点子节点的对比
                patch = diffChildren(oldNode, newNode, patches, patch, index)
            }
        } else {
            // 新老节点替换旧节点
            patch = appendPatch(patch, {
                type: PATCH.REPLACE,
                vNode: newNode
            })
        }
    } else if (isVText(newNode)) {
        if (!isVText(oldNode)) {
            // 将旧节点替换成文本节点
            patch = appendPatch(patch, {
                type: PATCH.VTEXT,
                vNode: newNode
            })
        } else if (newNode.text !== oldNode.text) {
            // 替换文本
            patch = appendPatch(patch, {
                type: PATCH.VTEXT,
                vNode: newNode
            })
        }
    }

    if (patch) {
        // 将补丁放入对应位置
        patches[index] = patch
    }
}

// 一点节点可能有多个patch
// 多个patch时，使用数组进行存储
function appendPatch(patch, apply) {
    if (patch) {
        if (isArray(patch)) {
            patch.push(apply)
        } else {
            patch = [patch, apply]
        }

        return patch
    } else {
        return apply
    }
}

// 属性的对比
function diffProps(newProps, oldProps) {
    const patches = []
    const props = Object.assign({}, newProps, oldProps)

    Object.keys(props).forEach(key => {
        const newVal = newProps[key]
        const oldVal = oldProps[key]
        if (!newVal) {
            patches.push({
                type: PATCH.REMOVE_PROP,
                key,
                value: oldVal
            })
        }

        if (oldVal === void 0 || newVal !== oldVal) {
            patches.push({
                type: PATCH.SET_PROP,
                key,
                value: newVal
            })
        }
    })

    return patches
}

// 子节点的对比
function diffChildren(oldNode, newNode, patches, patch, index) {
    const oldChildren = oldNode.children
    // 新节点按旧节点的顺序重新排序
    const sortedSet = sortChildren(oldChildren, newNode.children)
    const newChildren = sortedSet.children
    const oldLen = oldChildren.length
    const newLen = newChildren.length
    const len = oldLen > newLen ? oldLen : newLen
    for (let i = 0; i < len; i++) {
        let leftNode = oldChildren[i]
        let rightNode = newChildren[i]
        index++

        if (!leftNode) {
            if (rightNode) {
                // 旧节点不存在，新节点存在，进行插入操作
                patch = appendPatch(patch, {
                    type: PATCH.INSERT,
                    vNode: rightNode
                })
            }
        } else {
            walk(leftNode, rightNode, patches, index)
        }
        if (isVNode(leftNode) && isArray(leftNode.children)) {
            index += leftNode.children.length
        }
    }

    if (sortedSet.moves) {
        // 最后进行重新排序
        patch = appendPatch(patch, {
            type: PATCH.ORDER,
            moves: sortedSet.moves
        })
    }

    return patches
}

// 子节点的重新排序
function sortChildren(oldChildren, newChildren) {
    // 找出变化后的子节点中带key的vdom（keys），和不带key的vdom（free）
    const newChildIndex = keyIndex(newChildren)
    const newKeys = newChildIndex.keys
    const newFree = newChildIndex.free

    // 所有子节点无key 不进行对比
    if (newFree.length === newChildren.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    // 找出变化前的子节点中带key的vdom（keys），和不带key的vdom（free）
    const oldChildIndex = keyIndex(oldChildren)
    const oldKeys = oldChildIndex.keys
    const oldFree = oldChildIndex.free

    // 所有子节点无key 不进行对比
    if (oldFree.length === oldChildren.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    // O(MAX(N, M))memory
    const shuffle = []

    const freeCount = newFree.length
    let freeIndex = 0
    let deleteItems = 0

    // 遍历变化前的子节点，对比变化后子节点的key值
    // 并按照对应顺序将变化后子节点的索引放入shuffle数组中
    for (let i = 0; i < oldChildren.length; i++) {
        const oldItem = oldChildren[i]
        let itemIndex

        if (oldItem.key) {
            if (newKeys.hasOwnProperty(oldItem.key)) {
                // 匹配到变化前节点中存在的key
                itemIndex = newKeys[oldItem.key]
                shuffle.push(newChildren[itemIndex])
            } else {
                // 移除变化后节点不存在的key值
                deleteItems++
                shuffle.push(null)
            }
        } else {
            if (freeIndex < freeCount) {
                // 匹配变化前后的无key子节点
                itemIndex = newFree[freeIndex++]
                shuffle.push(newChildren[itemIndex])
            } else {
                // 如果变化后子节点中已经不存在无key项
                // 变化前的无key项也是多余项，故删除
                deleteItems++
                shuffle.push(null)
            }
        }
    }

    const lastFreeIndex = freeIndex >= newFree.length ? newChildren.length : newFree[freeIndex]

    // 遍历变化后的子节点，将所有值钱不存在的key对于的子节点放入shuffle数组中
    for (let j = 0; j < newChildren.length; j++) {
        const newItem = newChildren[j]
        if (newItem.key) {
            if (!oldKeys.hasOwnProperty(newItem.key)) {
                // 添加所有新的key值对应的子节点
                // 之后还会重新排序，我们会在适当的地方插入新增节点
                shuffle.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // 添加剩余的无key子节点
            shuffle.push(newItem)
        }
    }

    const simulate = shuffle.slice()
    const removes = []
    const inserts = []
    let simulateIndex = 0
    let simulateItem
    let wantedItem

    for (let k = 0; k < newChildren.length;) {
        wantedItem = newChildren[k] // 期待元素：表示变化后k的子节点
        simulateItem = simulate[simulateIndex] // 模拟元素：表示变化前k位置的子节点

        // 删除在变化后不存在的子节点
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // 期待元素的key值存在
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // 如果一个带key的子元素没有在合适的位置，则进行移动
                    if (newKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // 如果removes没有把期待元素放到合适的位置上，则进行插入
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({ key: wantedItem.key, to: k })
                        } else {
                            // 匹配上了，就跳过
                            simulateIndex++
                        }
                    } else {
                        inserts.push({ key: wantedItem.key, to: k })
                    }
                } else {
                    inserts.push({ key: wantedItem.key, to: k })
                }
                k++
            }
            // 该位置期待元素的key值不存在，且模拟元素存在key值
            else if (simulateItem && simulateItem.key) {
                // 变化前该位置的元素
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        } else {
            // 如果期待元素和模拟元素key值相等，跳到下一个子节点比对
            simulateIndex++
            k++
        }
    }

    // 移除所有的模拟元素
    while (simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // 如果只有删除选项中有值
    // 将操作直接交给delete patch
    if (removes.length === deleteItems && !inserts.length) {
        return {
            children: shuffle,
            moves: null
        }
    }

    return {
        children: shuffle,
        moves: {
            removes,
            inserts
        }
    }
}

function keyIndex(children) {
    const keys = []
    const free = []
    const length = children.length

    for (let i = 0; i < length; i++) {
        const child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys, // 子节点中所有存在的key对应的索引
        free // 子节点中不存在key值的索引
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1) // 移除数组中指定元素

    return {
        from: index,
        key
    }
}

// 更新DOM
function patch(rootNode, patches) {
    if (!patches || patches.length === 0) return
    // 取得对应index的真实DOM
    const nodes = domIndex(rottNode)
    patches.forEach((patch, index) => {
        patch && applyPatch(nodes[index], patch)
    })
}

function domIndex(rootNode) {
    const nodes = [rootNode]
    const children = rootNode.childNodes
    if (children.length) {
        for (let child of children) {
            if (chuld.nodeType === 1 || child.nodeType === 3) {
                if (child.nodeType === 1) {
                    nodes.push(...domIndex(child))
                } else if (child.nodeType === 3) {
                    nodes.push(child)
                }
            }
        }
    }
    return nodes
}

function applyPatch(node, patchList) {
    for (let patch of patchList) {
        patchOp(node, patch)
    }
}

function patchOp(node, patch) {
    const { type, vNode } = patch
    const parentNode = node.parentNode
    let newNode = null
    switch (type) {
        case PATCH.INSERT:
            // 插入新节点
            break;
        case PATCH.REMOVE:
            // 删除旧节点
            break;
        case PATCH.REPLACE:
            // 替换节点
            break;
        case PATCH.ORDER:
            // 子节点重新排序
            break;
        case PATCH.VTEXT:
            // 替换文本节点
            break;
        case PATCH.PROPS:
            // 更新节点属性
            break;
        default:
            break;
    }
}
