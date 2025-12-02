import React from 'react';
import { Form, Input, InputNumber, Switch, Select, Collapse } from 'antd';
import type { FormInstance } from 'antd';
import type { PackageParameter } from '../../types';

const { Panel } = Collapse;

interface ParameterFormProps {
  parameters: PackageParameter[];
  form: FormInstance;
}

/**
 * 动态参数配置表单组件
 * 根据 metadata.json 中的参数定义动态生成表单控件
 */
export const ParameterForm: React.FC<ParameterFormProps> = ({ parameters }) => {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  /**
   * 根据参数类型渲染对应的表单控件
   */
  const renderFormControl = (param: PackageParameter) => {
    const { type, options, placeholder, min, max, max_len } = param;

    switch (type) {
      case 'number':
        return (
          <InputNumber
            style={{ width: '100%' }}
            min={min}
            max={max}
            placeholder={placeholder || `请输入${param.label}`}
          />
        );

      case 'boolean':
        return (
          <Switch
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        );

      case 'select':
        return (
          <Select
            placeholder={placeholder || `请选择${param.label}`}
            options={options?.map(opt => ({
              label: opt.label,
              value: opt.value,
            }))}
          />
        );

      case 'string':
      default:
        return (
          <Input
            placeholder={placeholder || `请输入${param.label}`}
            maxLength={max_len}
          />
        );
    }
  };

  /**
   * 生成表单验证规则
   */
  const getValidationRules = (param: PackageParameter) => {
    const rules: any[] = [];

    // 必填验证
    if (param.required) {
      rules.push({
        required: true,
        message: `${param.label}是必填项`,
      });
    }

    // 数字范围验证
    if (param.type === 'number') {
      if (param.min !== undefined) {
        rules.push({
          type: 'number',
          min: param.min,
          message: `${param.label}不能小于${param.min}`,
        });
      }
      if (param.max !== undefined) {
        rules.push({
          type: 'number',
          max: param.max,
          message: `${param.label}不能大于${param.max}`,
        });
      }
    }

    // 字符串长度验证
    if (param.type === 'string') {
      if (param.min_len !== undefined) {
        rules.push({
          min: param.min_len,
          message: `${param.label}长度不能少于${param.min_len}个字符`,
        });
      }
      if (param.max_len !== undefined) {
        rules.push({
          max: param.max_len,
          message: `${param.label}长度不能超过${param.max_len}个字符`,
        });
      }
      // 正则验证
      if (param.pattern) {
        rules.push({
          pattern: new RegExp(param.pattern),
          message: `${param.label}格式不正确`,
        });
      }
    }

    return rules;
  };

  // 分离基础参数和高级参数
  const basicParams = parameters.filter(p => !p.advanced);
  const advancedParams = parameters.filter(p => p.advanced);

  return (
    <>
      {/* 基础参数 */}
      {basicParams.map((param) => (
        <Form.Item
          key={param.name}
          name={param.name}
          label={param.label}
          initialValue={param.default}
          tooltip={param.description}
          rules={getValidationRules(param)}
          valuePropName={param.type === 'boolean' ? 'checked' : 'value'}
        >
          {renderFormControl(param)}
        </Form.Item>
      ))}

      {/* 高级参数 - 可折叠 */}
      {advancedParams.length > 0 && (
        <Collapse ghost>
          <Panel header="高级配置（可选）" key="advanced">
            {advancedParams.map((param) => (
              <Form.Item
                key={param.name}
                name={param.name}
                label={param.label}
                initialValue={param.default}
                tooltip={param.description}
                rules={getValidationRules(param)}
                valuePropName={param.type === 'boolean' ? 'checked' : 'value'}
              >
                {renderFormControl(param)}
              </Form.Item>
            ))}
          </Panel>
        </Collapse>
      )}
    </>
  );
};
