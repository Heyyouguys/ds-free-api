//! OpenAI 模型列表响应生成
//!
//! 基于 DeepSeek model_types + model_aliases 静态生成 OpenAI /models 响应。

use crate::openai_adapter::types::{OpenAIModel, OpenAIModelList};

const MODEL_CREATED: u64 = 1_090_108_800;
const MODEL_OWNED_BY: &str = "deepseek-web (proxied by https://github.com/NIyueeE)";

/// 根据 model_types + aliases 生成模型列表
pub fn list(
    model_types: &[String],
    max_input_tokens: &[u32],
    max_output_tokens: &[u32],
    aliases: &[String],
) -> OpenAIModelList {
    let mut data: Vec<OpenAIModel> = model_types
        .iter()
        .enumerate()
        .map(|(idx, ty)| {
            let input = max_input_tokens.get(idx).copied();
            let output = max_output_tokens.get(idx).copied();
            make_model(&format!("deepseek-{}", ty), input, output)
        })
        .collect();

    // 添加别名模型（按 index 对齐 model_types）
    for (i, alias) in aliases.iter().enumerate() {
        if let Some(_ty) = model_types.get(i) {
            let input = max_input_tokens.get(i).copied();
            let output = max_output_tokens.get(i).copied();
            data.push(make_model(alias, input, output));
        }
    }

    // 裸 model_type 名（`default` / `expert` / `vision`）也必须出现在列表中：
    // `model_registry()` 接受这些写法（issue #99），列表与解析器必须一致，
    // 否则客户端拉取 /v1/models 后仍找不到可用模型。
    for (idx, ty) in model_types.iter().enumerate() {
        if aliases.get(idx).is_some_and(|a| a.eq_ignore_ascii_case(ty)) {
            continue;
        }
        let input = max_input_tokens.get(idx).copied();
        let output = max_output_tokens.get(idx).copied();
        data.push(make_model(ty, input, output));
    }

    OpenAIModelList {
        object: "list",
        data,
    }
}

/// 查询单个模型
pub fn get(
    model_types: &[String],
    max_input_tokens: &[u32],
    max_output_tokens: &[u32],
    aliases: &[String],
    id: &str,
) -> Option<OpenAIModel> {
    let target = id.to_lowercase();

    // 先查 model_types
    if let Some((idx, ty)) = model_types
        .iter()
        .enumerate()
        .find(|(_, ty)| format!("deepseek-{}", ty).to_lowercase() == target)
    {
        let input = max_input_tokens.get(idx).copied();
        let output = max_output_tokens.get(idx).copied();
        return Some(make_model(&format!("deepseek-{}", ty), input, output));
    }

    // 再查裸 model_type 名（`default` == `deepseek-default`，issue #99）
    if let Some((idx, ty)) = model_types
        .iter()
        .enumerate()
        .find(|(_, ty)| ty.to_lowercase() == target)
    {
        let input = max_input_tokens.get(idx).copied();
        let output = max_output_tokens.get(idx).copied();
        return Some(make_model(ty, input, output));
    }

    // 再查 aliases（按 index 对齐 model_types）
    for (i, alias) in aliases.iter().enumerate() {
        if alias.to_lowercase() == target
            && let Some(_ty) = model_types.get(i)
        {
            let input = max_input_tokens.get(i).copied();
            let output = max_output_tokens.get(i).copied();
            return Some(make_model(&target, input, output));
        }
    }

    None
}

fn make_model(id: &str, input: Option<u32>, output: Option<u32>) -> OpenAIModel {
    OpenAIModel {
        id: id.to_string(),
        object: "model",
        created: MODEL_CREATED,
        owned_by: MODEL_OWNED_BY,
        max_input_tokens: input,
        max_output_tokens: output,
        context_length: input,
        context_window: input,
        max_context_length: input,
        max_tokens: output,
        max_completion_tokens: output,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn types() -> Vec<String> {
        vec!["default".to_string(), "expert".to_string()]
    }
    fn limits() -> (Vec<u32>, Vec<u32>) {
        (vec![100, 200], vec![10, 20])
    }

    #[test]
    fn list_includes_prefixed_and_bare_names() {
        let (mi, mo) = limits();
        let list = list(&types(), &mi, &mo, &[]);
        let ids: Vec<&str> = list.data.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"deepseek-default"));
        assert!(ids.contains(&"default"), "裸 model_type 名必须在列表中");
        assert!(ids.contains(&"deepseek-expert"));
        assert!(ids.contains(&"expert"));
    }

    #[test]
    fn get_accepts_prefixed_and_bare_names() {
        let (mi, mo) = limits();
        for id in ["deepseek-default", "DEFAULT", "default", "deepseek-expert"] {
            assert!(get(&types(), &mi, &mo, &[], id).is_some(), "{id} 应可查询");
        }
        assert!(get(&types(), &mi, &mo, &[], "nope").is_none());
    }

    #[test]
    fn get_accepts_aliases() {
        let (mi, mo) = limits();
        let aliases = vec!["gpt-4o".to_string()];
        let model = get(&types(), &mi, &mo, &aliases, "gpt-4o").expect("alias must resolve");
        assert_eq!(model.max_input_tokens, Some(100));
    }

    #[test]
    fn list_does_not_duplicate_alias_equal_to_type_name() {
        let (mi, mo) = limits();
        let aliases = vec!["default".to_string()];
        let list = list(&types(), &mi, &mo, &aliases);
        let count = list.data.iter().filter(|m| m.id == "default").count();
        assert_eq!(count, 1, "别名与 model_type 同名时不应重复列出");
    }
}
